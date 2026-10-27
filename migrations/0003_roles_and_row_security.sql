-- Bootstrap runs as a database administrator. Application logins only inherit the NOLOGIN roles below.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p07_app') THEN CREATE ROLE p07_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p07_worker') THEN CREATE ROLE p07_worker NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='p07_control') THEN CREATE ROLE p07_control NOLOGIN NOSUPERUSER BYPASSRLS; END IF;
END $$;
GRANT p07_app TO p07_worker;
REVOKE ALL ON SCHEMA p07 FROM PUBLIC;
GRANT USAGE ON SCHEMA p07 TO p07_app,p07_worker,p07_control;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA p07 TO p07_app;
REVOKE ALL ON p07.privacy_policies,p07.capability_releases FROM p07_app;
GRANT SELECT ON p07.privacy_policies,p07.capability_releases TO p07_app;

DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='p07' LOOP
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='p07' AND table_name=t.tablename AND column_name='owner_id') THEN
   EXECUTE format('ALTER TABLE p07.%I ENABLE ROW LEVEL SECURITY',t.tablename);
   EXECUTE format('ALTER TABLE p07.%I FORCE ROW LEVEL SECURITY',t.tablename);
   EXECUTE format('CREATE POLICY owner_access ON p07.%I TO p07_app USING (owner_id::text=current_setting(''p07.owner_id'',true)) WITH CHECK(owner_id::text=current_setting(''p07.owner_id'',true))',t.tablename);
  END IF;
 END LOOP;
END $$;
ALTER TABLE p07.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE p07.accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_account ON p07.accounts TO p07_app USING(id::text=current_setting('p07.owner_id',true)) WITH CHECK(id::text=current_setting('p07.owner_id',true));

-- A small internal role bypasses RLS only inside fixed security-definer functions.
-- It has no login, no membership granted to API/worker, and no DDL authority.
GRANT SELECT ON p07.accounts,p07.platform_identities,p07.sessions,p07.jobs,p07.outbox_events,
 p07.orders,p07.payment_attempts,p07.agent_sessions,p07.tasks,p07.processing_contracts TO p07_control;
GRANT UPDATE ON p07.jobs,p07.outbox_events TO p07_control;

CREATE FUNCTION p07.auth_session(p_hash text)
 RETURNS TABLE(owner_id uuid,identity_id uuid,provider text,app_alias text,session_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT s.owner_id,s.identity_id,i.provider,i.app_alias,s.id
 FROM p07.sessions s JOIN p07.platform_identities i ON i.id=s.identity_id AND i.owner_id=s.owner_id
 JOIN p07.accounts a ON a.id=s.owner_id
 WHERE length(p_hash)=64 AND s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now() AND a.status='ACTIVE'
$$;
ALTER FUNCTION p07.auth_session(text) OWNER TO p07_control;

CREATE FUNCTION p07.lookup_identity(p_provider text,p_app text,p_subject_hash text)
 RETURNS TABLE(owner_id uuid,identity_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT i.owner_id,i.id FROM p07.platform_identities i JOIN p07.accounts a ON a.id=i.owner_id
 WHERE i.provider=p_provider AND i.app_alias=p_app AND i.subject_hash=p_subject_hash AND length(p_subject_hash)=64 AND a.status='ACTIVE'
$$;
ALTER FUNCTION p07.lookup_identity(text,text,text) OWNER TO p07_control;

CREATE FUNCTION p07.claim_job(p_worker text,p_lease_seconds integer)
 RETURNS SETOF p07.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
BEGIN
 IF p_worker !~ '^[a-zA-Z0-9_-]{1,100}$' OR p_lease_seconds<30 OR p_lease_seconds>300 THEN
  RAISE EXCEPTION 'INVALID_LEASE';
 END IF;
 RETURN QUERY WITH candidate AS (
  SELECT j.id FROM p07.jobs j WHERE j.available_at<=clock_timestamp()
   AND (j.status='READY' OR (j.status='LEASED' AND j.lease_until<clock_timestamp()))
   AND j.attempts<CASE WHEN j.kind='CLEANUP' THEN 100 ELSE 3 END
  ORDER BY j.priority DESC,j.available_at,j.id FOR UPDATE SKIP LOCKED LIMIT 1
 ) UPDATE p07.jobs j SET status='LEASED',lease_owner=p_worker,
   lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),fence=j.fence+1,attempts=j.attempts+1
 FROM candidate c WHERE j.id=c.id RETURNING j.*;
END $$;
ALTER FUNCTION p07.claim_job(text,integer) OWNER TO p07_control;

CREATE FUNCTION p07.expired_sessions(p_limit integer)
 RETURNS TABLE(owner_id uuid,session_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT s.owner_id,s.id FROM p07.agent_sessions s WHERE s.idle_expires_at<now()
 AND s.status IN ('READY_FOR_INPUT','INPUT_RECEIVED','WAITING_CONFIRMATION','QUOTABLE','AWAITING_PAYMENT')
 ORDER BY s.idle_expires_at LIMIT least(greatest(p_limit,1),100)
$$;
ALTER FUNCTION p07.expired_sessions(integer) OWNER TO p07_control;

CREATE FUNCTION p07.find_payment_order(p_provider text,p_reference text)
 RETURNS TABLE(owner_id uuid,order_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT a.owner_id,a.order_id FROM p07.payment_attempts a JOIN p07.orders o ON o.id=a.order_id AND o.owner_id=a.owner_id
 WHERE o.provider=p_provider AND a.provider_order_ref=p_reference LIMIT 1
$$;
ALTER FUNCTION p07.find_payment_order(text,text) OWNER TO p07_control;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA p07 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.auth_session(text),p07.lookup_identity(text,text,text),p07.find_payment_order(text,text) TO p07_app;
GRANT EXECUTE ON FUNCTION p07.claim_job(text,integer),p07.expired_sessions(integer) TO p07_worker;
