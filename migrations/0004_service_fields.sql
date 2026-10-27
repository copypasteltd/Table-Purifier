ALTER TABLE p07.tasks ADD COLUMN standard_definition jsonb, ADD COLUMN standard_reference jsonb;
ALTER TABLE p07.source_files ADD COLUMN session_id uuid;
ALTER TABLE p07.source_files ADD CONSTRAINT source_session_owner FOREIGN KEY(owner_id,session_id) REFERENCES p07.agent_sessions(owner_id,id);
ALTER TABLE p07.execution_plans ADD COLUMN source_set_id uuid, ADD COLUMN goal_version bigint;
ALTER TABLE p07.execution_plans ADD CONSTRAINT plan_source_owner FOREIGN KEY(owner_id,source_set_id) REFERENCES p07.source_sets(owner_id,id);
ALTER TABLE p07.schema_proposals ADD COLUMN plan_id uuid;
ALTER TABLE p07.schema_proposals ADD CONSTRAINT proposal_plan_owner FOREIGN KEY(owner_id,plan_id) REFERENCES p07.execution_plans(owner_id,id);
ALTER TABLE p07.source_files ADD COLUMN readability_reason text;
ALTER TABLE p07.payment_attempts ADD COLUMN checkout_payload jsonb;
ALTER TABLE p07.runtime_cleanup_jobs ADD COLUMN operation_id uuid;
ALTER TABLE p07.idempotency_records ADD COLUMN session_id uuid;
ALTER TABLE p07.agent_sessions ADD COLUMN client_request_id uuid;
CREATE UNIQUE INDEX session_client_request ON p07.agent_sessions(owner_id,client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX active_initial_run ON p07.runs(owner_id,contract_id) WHERE parent_run_id IS NULL;

-- Replayed platform codes are consumed atomically with account creation and login.
CREATE TABLE p07_meta.login_code_uses(provider text NOT NULL,app_alias text NOT NULL,code_sha256 text NOT NULL,used_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,app_alias,code_sha256));
GRANT USAGE ON SCHEMA p07_meta TO p07_control;
GRANT SELECT,INSERT ON p07_meta.login_code_uses TO p07_control;
GRANT INSERT ON p07.accounts,p07.platform_identities,p07.sessions TO p07_control;
CREATE FUNCTION p07.create_platform_login(p_provider text,p_app text,p_subject_hash text,p_subject_cipher text,p_code_hash text,p_token_hash text)
 RETURNS TABLE(account_id uuid,identity_id uuid,expires_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 DECLARE v_owner uuid;v_identity uuid;v_expires timestamptz:=clock_timestamp()+interval '7 days';
 BEGIN
  IF p_provider NOT IN ('ALIPAY','DOUYIN') OR length(p_app)>200 OR length(p_subject_hash)<>64 OR length(p_code_hash)<>64 OR length(p_token_hash)<>64 THEN
   RAISE EXCEPTION 'INVALID_IDENTITY';
  END IF;
  INSERT INTO p07_meta.login_code_uses(provider,app_alias,code_sha256) VALUES(p_provider,p_app,p_code_hash);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_provider||p_app||p_subject_hash,0));
  SELECT i.owner_id,i.id INTO v_owner,v_identity FROM p07.platform_identities i JOIN p07.accounts a ON a.id=i.owner_id
   WHERE i.provider=p_provider AND i.app_alias=p_app AND i.subject_hash=p_subject_hash AND a.status='ACTIVE';
  IF v_owner IS NULL THEN
   IF EXISTS(SELECT 1 FROM p07.platform_identities WHERE provider=p_provider AND app_alias=p_app AND subject_hash=p_subject_hash) THEN
    RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE';
   END IF;
   v_owner:=gen_random_uuid();v_identity:=gen_random_uuid();
   INSERT INTO p07.accounts(id,status) VALUES(v_owner,'ACTIVE');
   INSERT INTO p07.platform_identities(id,owner_id,provider,app_alias,subject_cipher_ref,subject_hash,verified_at)
    VALUES(v_identity,v_owner,p_provider,p_app,p_subject_cipher,p_subject_hash,clock_timestamp());
  END IF;
  INSERT INTO p07.sessions(id,owner_id,identity_id,token_hash,expires_at) VALUES(gen_random_uuid(),v_owner,v_identity,p_token_hash,v_expires);
  RETURN QUERY SELECT v_owner,v_identity,v_expires;
 END $$;
ALTER FUNCTION p07.create_platform_login(text,text,text,text,text,text) OWNER TO p07_control;
REVOKE EXECUTE ON FUNCTION p07.create_platform_login(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.create_platform_login(text,text,text,text,text,text) TO p07_app;

-- Minimal privacy declaration is source controlled. Provider regions/retention must be configured before enabling Agent.
INSERT INTO p07.privacy_policies(id,policy_version,environment,content,content_sha256,effective_at)
 VALUES('bfe873aa-192a-43f6-8c64-673d04372700','privacy-2026-10-27','ALL',
 '{"purposes":["读取并整理用户主动提交的资料","用户确认后按原订单生产并保留结果"],"processors":[],"retention_categories":[{"category":"TASK_RUNTIME","policy_id":"AFTER_DURABLE_RESULT_PUBLISH","duration_seconds":null,"limitations":"结果保存后删除任务环境；取消、失败、闲置到期也触发清理"},{"category":"RESULT","policy_id":"PERSIST_UNTIL_OWNER_REQUEST","duration_seconds":null,"limitations":"结果文件持续保留，用户主动删除另行处理"}]}'::jsonb,
 repeat('0',64),now());
