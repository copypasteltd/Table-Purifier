ALTER TABLE p07.revision_intents ADD COLUMN billing_class text NOT NULL DEFAULT 'USER_REVISION'
 CHECK(billing_class IN('USER_REVISION','PLATFORM_CORRECTION'));
ALTER TABLE p07.processing_contracts ADD COLUMN budget_contract_id uuid;
ALTER TABLE p07.processing_contracts ADD FOREIGN KEY(owner_id,budget_contract_id) REFERENCES p07.processing_contracts(owner_id,id);
CREATE TABLE p07.correction_authorizations(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,ticket_id uuid NOT NULL,parent_run_id uuid NOT NULL,parent_result_id uuid NOT NULL,
 contract_id uuid NOT NULL,original_order_id uuid NOT NULL,budget_contract_id uuid NOT NULL,estimated_quote_id uuid NOT NULL,
 plan_sha256 text NOT NULL,source_scope_sha256 text NOT NULL,approved_by_sha256 text NOT NULL CHECK(length(approved_by_sha256)=64),
 review_receipt_ref text NOT NULL,reason_code text NOT NULL CHECK(reason_code IN('OMITTED_FIELD','EXTRACTION_ERROR')),
 status text NOT NULL DEFAULT 'APPROVED' CHECK(status IN('APPROVED','USED','REVOKED')),used_run_id uuid,expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,id),UNIQUE(owner_id,contract_id),
 FOREIGN KEY(owner_id,ticket_id) REFERENCES p07.support_tickets(owner_id,id),
 FOREIGN KEY(owner_id,parent_run_id) REFERENCES p07.runs(owner_id,id),
 FOREIGN KEY(owner_id,contract_id) REFERENCES p07.processing_contracts(owner_id,id),
 FOREIGN KEY(owner_id,original_order_id) REFERENCES p07.orders(owner_id,id),
 FOREIGN KEY(owner_id,budget_contract_id) REFERENCES p07.processing_contracts(owner_id,id)
);
ALTER TABLE p07.correction_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE p07.correction_authorizations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON p07.correction_authorizations TO p07_app USING(owner_id::text=current_setting('p07.owner_id',true)) WITH CHECK(owner_id::text=current_setting('p07.owner_id',true));
GRANT SELECT,INSERT,UPDATE ON p07.correction_authorizations TO p07_app;

-- A correction continues a particular original paid order; it is never FREE.
CREATE OR REPLACE FUNCTION p07.guard_new_run() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,p07 AS $$
DECLARE g p07.entitlement_grants; o p07.orders; c p07.processing_contracts; p p07.execution_plans; s p07.agent_sessions;
BEGIN
 SELECT * INTO g FROM p07.entitlement_grants WHERE id=NEW.grant_id AND owner_id=NEW.owner_id FOR UPDATE;
 IF NOT FOUND OR g.kind<>'PAID' OR g.revoked_at IS NOT NULL OR (g.expires_at IS NOT NULL AND g.expires_at<=now()) OR g.contract_id<>NEW.contract_id
 THEN RAISE EXCEPTION 'PAYMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO o FROM p07.orders WHERE id=g.order_id AND owner_id=NEW.owner_id;
 IF NOT FOUND OR o.payment_status<>'CONFIRMED' OR o.amount_minor<=0 OR o.refunded_minor+o.refund_reserved_minor>0 OR o.reconciliation_required
 THEN RAISE EXCEPTION 'PAYMENT_REQUIRED' USING ERRCODE='P0001'; END IF;
 IF o.contract_id<>NEW.contract_id AND NOT EXISTS(
  SELECT 1 FROM p07.correction_authorizations a JOIN p07.revision_intents ri ON ri.task_id=NEW.task_id AND ri.owner_id=a.owner_id
  WHERE a.owner_id=NEW.owner_id AND a.contract_id=NEW.contract_id AND a.original_order_id=o.id AND a.expires_at>now()
   AND (a.status='APPROVED' OR (a.status='USED' AND a.used_run_id=NEW.id)) AND ri.billing_class='PLATFORM_CORRECTION'
   AND a.parent_run_id=NEW.parent_run_id AND a.parent_result_id=NEW.parent_result_id
   AND ri.parent_run_id=a.parent_run_id AND ri.parent_result_id=a.parent_result_id)
 THEN RAISE EXCEPTION 'ORIGINAL_PAID_CORRECTION_REQUIRED' USING ERRCODE='P0001'; END IF;
 SELECT * INTO c FROM p07.processing_contracts WHERE id=NEW.contract_id AND owner_id=NEW.owner_id;
 SELECT * INTO p FROM p07.execution_plans WHERE id=c.confirmed_plan_id AND owner_id=NEW.owner_id;
 IF c.task_id<>NEW.task_id OR c.schema_binding_id IS DISTINCT FROM NEW.schema_binding_id OR p.status<>'CONFIRMED' OR p.binding_id IS DISTINCT FROM c.schema_binding_id
 THEN RAISE EXCEPTION 'PLAN_MISMATCH' USING ERRCODE='P0001'; END IF;
 SELECT a.* INTO s FROM p07.tasks t JOIN p07.agent_sessions a ON a.id=t.agent_session_id AND a.owner_id=t.owner_id WHERE t.id=NEW.task_id AND t.owner_id=NEW.owner_id;
 IF NOT FOUND OR s.status NOT IN('AWAITING_PAYMENT','BATCH_QUEUED') OR s.cleanup_status<>'NOT_REQUESTED'
 THEN RAISE EXCEPTION 'INVALID_SESSION_PHASE' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
