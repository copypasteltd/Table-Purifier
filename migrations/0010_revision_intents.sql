CREATE TABLE p07.revision_intents(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,batch_id uuid NOT NULL,parent_run_id uuid NOT NULL,parent_result_id uuid NOT NULL,
 session_id uuid NOT NULL,task_id uuid,status text NOT NULL DEFAULT 'INITIALIZING' CHECK(status IN('INITIALIZING','INPUT_READY','QUEUED','COMPLETED','CANCELED')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,id),UNIQUE(batch_id),UNIQUE(session_id),
 FOREIGN KEY(owner_id,parent_run_id) REFERENCES p07.runs(owner_id,id),
 FOREIGN KEY(owner_id,session_id) REFERENCES p07.agent_sessions(owner_id,id),
 FOREIGN KEY(owner_id,batch_id) REFERENCES p07.decision_batches(owner_id,id)
);
ALTER TABLE p07.revision_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE p07.revision_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON p07.revision_intents TO p07_app USING(owner_id::text=current_setting('p07.owner_id',true))
 WITH CHECK(owner_id::text=current_setting('p07.owner_id',true));
GRANT SELECT,INSERT,UPDATE,DELETE ON p07.revision_intents TO p07_app;
GRANT USAGE ON SCHEMA p07_meta TO p07_app;
GRANT SELECT ON p07_meta.migrations TO p07_app;

-- A pending deletion can still read its status/financial history; the API denies all other business writes.
CREATE OR REPLACE FUNCTION p07.auth_session(p_hash text)
 RETURNS TABLE(owner_id uuid,identity_id uuid,provider text,app_alias text,session_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT s.owner_id,s.identity_id,i.provider,i.app_alias,s.id FROM p07.sessions s
 JOIN p07.platform_identities i ON i.id=s.identity_id AND i.owner_id=s.owner_id JOIN p07.accounts a ON a.id=s.owner_id
 WHERE length(p_hash)=64 AND s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now() AND a.status IN('ACTIVE','DELETION_PENDING')
$$;
ALTER FUNCTION p07.auth_session(text) OWNER TO p07_control;
REVOKE EXECUTE ON FUNCTION p07.auth_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.auth_session(text) TO p07_app;
