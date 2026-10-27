-- Executable evolution of the reference model; no customer data or credentials.
ALTER TABLE p07.agent_sessions ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK(version>=1);
ALTER TABLE p07.agent_sessions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE p07.agent_sessions ADD COLUMN idle_expires_at timestamptz;
ALTER TABLE p07.agent_sessions ADD COLUMN adjustment_rounds integer NOT NULL DEFAULT 0 CHECK(adjustment_rounds>=0);
ALTER TABLE p07.agent_sessions ADD COLUMN active_job_id uuid;
ALTER TABLE p07.agent_sessions ADD COLUMN process_id integer;
ALTER TABLE p07.agent_sessions ADD COLUMN process_started_at timestamptz;
ALTER TABLE p07.tasks ADD COLUMN current_plan_id uuid;
ALTER TABLE p07.tasks ADD CONSTRAINT tasks_current_plan_fk FOREIGN KEY(owner_id,current_plan_id) REFERENCES p07.execution_plans(owner_id,id);
ALTER TABLE p07.execution_plans ADD COLUMN summary jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE p07.execution_plans ADD COLUMN estimated_records integer CHECK(estimated_records>=0 AND estimated_records<=1000);
ALTER TABLE p07.execution_plans ADD COLUMN measured_units integer CHECK(measured_units>=1 AND measured_units<=50);
ALTER TABLE p07.source_files ADD COLUMN measurement jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE p07.idempotency_records ADD COLUMN response_body jsonb;
ALTER TABLE p07.idempotency_records ADD COLUMN state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','COMPLETED'));
ALTER TABLE p07.agent_workspaces ADD COLUMN isolation_receipt jsonb;
CREATE UNIQUE INDEX one_task_per_agent_session ON p07.tasks(agent_session_id);
CREATE UNIQUE INDEX one_active_turn_per_session ON p07.agent_turns(session_id) WHERE status IN ('QUEUED','RUNNING');
CREATE INDEX agent_idle_cleanup ON p07.agent_sessions(idle_expires_at) WHERE status IN ('READY_FOR_INPUT','INPUT_RECEIVED','WAITING_CONFIRMATION','QUOTABLE','AWAITING_PAYMENT');

-- Reject gates even if a future route forgets the service check.
CREATE FUNCTION p07.guard_new_task() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,p07 AS $$
DECLARE s p07.agent_sessions;
BEGIN
 SELECT * INTO s FROM p07.agent_sessions WHERE id=NEW.agent_session_id AND owner_id=NEW.owner_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'READY_FOR_INPUT' OR s.preload_receipt IS NULL
    OR (s.preload_receipt->>'bootstrap_completed') IS DISTINCT FROM 'true'
    OR (s.preload_receipt->>'host_composition_verified') IS DISTINCT FROM 'true'
    OR (s.preload_receipt->>'skill_manifest_sha256') IS DISTINCT FROM s.skill_manifest_sha256
 THEN RAISE EXCEPTION 'SESSION_NOT_READY' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER new_task_requires_ready_session BEFORE INSERT ON p07.tasks FOR EACH ROW EXECUTE FUNCTION p07.guard_new_task();

CREATE FUNCTION p07.guard_new_contract() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,p07 AS $$
DECLARE p p07.execution_plans; b p07.schema_bindings;
BEGIN
 SELECT * INTO p FROM p07.execution_plans WHERE id=NEW.confirmed_plan_id AND owner_id=NEW.owner_id;
 IF NOT FOUND OR p.status<>'CONFIRMED' OR p.task_id<>NEW.task_id OR p.binding_id<>NEW.schema_binding_id
 THEN RAISE EXCEPTION 'PLAN_NOT_CONFIRMED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO b FROM p07.schema_bindings WHERE id=NEW.schema_binding_id AND owner_id=NEW.owner_id;
 IF NOT FOUND OR b.task_id<>NEW.task_id OR b.source_set_id<>NEW.source_set_id OR b.goal_version<>NEW.goal_version
 THEN RAISE EXCEPTION 'BINDING_MISMATCH' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contract_requires_confirmation BEFORE INSERT ON p07.processing_contracts FOR EACH ROW EXECUTE FUNCTION p07.guard_new_contract();

CREATE FUNCTION p07.guard_new_run() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,p07 AS $$
DECLARE g p07.entitlement_grants; o p07.orders; c p07.processing_contracts; p p07.execution_plans; s p07.agent_sessions;
BEGIN
 SELECT * INTO g FROM p07.entitlement_grants WHERE id=NEW.grant_id AND owner_id=NEW.owner_id FOR UPDATE;
 IF NOT FOUND OR g.kind<>'PAID' OR g.revoked_at IS NOT NULL OR (g.expires_at IS NOT NULL AND g.expires_at<=now()) OR g.contract_id<>NEW.contract_id
 THEN RAISE EXCEPTION 'PAYMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO o FROM p07.orders WHERE id=g.order_id AND owner_id=NEW.owner_id;
 IF NOT FOUND OR o.payment_status<>'CONFIRMED' OR o.contract_id<>NEW.contract_id OR o.amount_minor<=0
    OR o.refunded_minor+o.refund_reserved_minor>0
 THEN RAISE EXCEPTION 'PAYMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO c FROM p07.processing_contracts WHERE id=NEW.contract_id AND owner_id=NEW.owner_id;
 SELECT * INTO p FROM p07.execution_plans WHERE id=c.confirmed_plan_id AND owner_id=NEW.owner_id;
 IF c.task_id<>NEW.task_id OR c.schema_binding_id IS DISTINCT FROM NEW.schema_binding_id OR p.status<>'CONFIRMED'
    OR p.binding_id IS DISTINCT FROM c.schema_binding_id
 THEN RAISE EXCEPTION 'PLAN_MISMATCH' USING ERRCODE='P0001'; END IF;
 SELECT a.* INTO s FROM p07.tasks t JOIN p07.agent_sessions a ON a.id=t.agent_session_id AND a.owner_id=t.owner_id
  WHERE t.id=NEW.task_id AND t.owner_id=NEW.owner_id;
 IF NOT FOUND OR s.status NOT IN ('AWAITING_PAYMENT','BATCH_QUEUED') OR s.cleanup_status<>'NOT_REQUESTED'
 THEN RAISE EXCEPTION 'INVALID_SESSION_PHASE' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER run_requires_paid_order BEFORE INSERT ON p07.runs FOR EACH ROW EXECUTE FUNCTION p07.guard_new_run();

CREATE FUNCTION p07.guard_session_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,p07 AS $$
DECLARE allowed text[];
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 allowed:=CASE OLD.status
  WHEN 'INITIALIZING' THEN ARRAY['READY_FOR_INPUT','INITIALIZATION_FAILED','CANCELED']
  WHEN 'READY_FOR_INPUT' THEN ARRAY['INPUT_RECEIVED','CANCELED']
  WHEN 'INPUT_RECEIVED' THEN ARRAY['ANALYZING','CANCELED','FAILED']
  WHEN 'ANALYZING' THEN ARRAY['WAITING_CONFIRMATION','FAILED','CANCELED']
  WHEN 'WAITING_CONFIRMATION' THEN ARRAY['ANALYZING','QUOTABLE','CANCELED']
  WHEN 'QUOTABLE' THEN ARRAY['ANALYZING','AWAITING_PAYMENT','CANCELED']
  WHEN 'AWAITING_PAYMENT' THEN ARRAY['ANALYZING','BATCH_QUEUED','CANCELED']
  WHEN 'BATCH_QUEUED' THEN ARRAY['BATCH_RUNNING','FAILED','CANCELED']
  WHEN 'BATCH_RUNNING' THEN ARRAY['PERSISTING_RESULTS','FAILED','CANCELED']
  WHEN 'PERSISTING_RESULTS' THEN ARRAY['RELEASING_RUNTIME','FAILED','CANCELED']
  WHEN 'RELEASING_RUNTIME' THEN ARRAY['CLOSED']
  WHEN 'INITIALIZATION_FAILED' THEN ARRAY['RELEASING_RUNTIME']
  WHEN 'FAILED' THEN ARRAY['RELEASING_RUNTIME']
  WHEN 'CANCELED' THEN ARRAY['RELEASING_RUNTIME']
  ELSE ARRAY[]::text[] END;
 IF NOT (NEW.status=ANY(allowed)) THEN RAISE EXCEPTION 'INVALID_SESSION_PHASE' USING ERRCODE='P0001'; END IF;
 IF NEW.status='CLOSED' AND (NEW.cleanup_status<>'SUCCEEDED' OR NEW.closed_at IS NULL)
 THEN RAISE EXCEPTION 'CLEANUP_INCOMPLETE' USING ERRCODE='P0001'; END IF;
 IF NEW.status='READY_FOR_INPUT' AND (NEW.preload_receipt IS NULL OR
    (NEW.preload_receipt->>'bootstrap_completed') IS DISTINCT FROM 'true' OR
    (NEW.preload_receipt->>'host_composition_verified') IS DISTINCT FROM 'true')
 THEN RAISE EXCEPTION 'SKILL_NOT_LOADED' USING ERRCODE='P0001'; END IF;
 NEW.version:=OLD.version+1; NEW.updated_at:=now();
 RETURN NEW;
END $$;
CREATE TRIGGER session_phase_guard BEFORE UPDATE ON p07.agent_sessions FOR EACH ROW EXECUTE FUNCTION p07.guard_session_transition();

CREATE FUNCTION p07.immutable_contract() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CONTRACT_IMMUTABLE' USING ERRCODE='P0001'; END $$;
CREATE TRIGGER processing_contract_immutable BEFORE UPDATE OR DELETE ON p07.processing_contracts FOR EACH ROW EXECUTE FUNCTION p07.immutable_contract();
CREATE TRIGGER quote_immutable BEFORE UPDATE OR DELETE ON p07.quotes FOR EACH ROW EXECUTE FUNCTION p07.immutable_contract();

CREATE FUNCTION p07.reject_free_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind<>'PAID' THEN RAISE EXCEPTION 'FREE_GRANT_FORBIDDEN' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER paid_grants_only BEFORE INSERT OR UPDATE ON p07.entitlement_grants FOR EACH ROW EXECUTE FUNCTION p07.reject_free_grant();
