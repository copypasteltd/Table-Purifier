GRANT SELECT ON p07.refunds TO p07_control;
CREATE FUNCTION p07.maintenance_candidates()
RETURNS TABLE(kind text,owner_id uuid,resource_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 (SELECT 'PAYMENT_QUERY'::text,o.owner_id,o.id FROM p07.orders o
  WHERE o.payment_status IN('PENDING','UNKNOWN') AND o.created_at>now()-interval '24 hours'
   AND EXISTS(SELECT 1 FROM p07.payment_attempts a WHERE a.order_id=o.id AND(a.last_checked_at IS NULL OR a.last_checked_at<now()-interval '30 seconds'))
  ORDER BY o.updated_at LIMIT 20)
 UNION ALL
 (SELECT 'REFUND_QUERY'::text,r.owner_id,r.id FROM p07.refunds r
  WHERE r.status IN('PROCESSING','UNKNOWN') AND(r.last_checked_at IS NULL OR r.last_checked_at<now()-interval '30 seconds')
  ORDER BY r.created_at LIMIT 20)
$$;
ALTER FUNCTION p07.maintenance_candidates() OWNER TO p07_control;
REVOKE ALL ON FUNCTION p07.maintenance_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.maintenance_candidates() TO p07_worker;

CREATE FUNCTION p07.reap_exhausted_jobs()
RETURNS SETOF p07.jobs LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 WITH exhausted AS (
  SELECT j.id FROM p07.jobs j WHERE j.status='LEASED' AND j.lease_until<clock_timestamp()
   AND j.attempts>=CASE WHEN j.kind='CLEANUP' THEN 100 ELSE 3 END
  ORDER BY j.lease_until LIMIT 20 FOR UPDATE SKIP LOCKED
 ) UPDATE p07.jobs j SET status='DEAD',last_error_code='LEASE_EXHAUSTED',lease_owner=NULL,lease_until=NULL
  FROM exhausted e WHERE j.id=e.id RETURNING j.*
$$;
ALTER FUNCTION p07.reap_exhausted_jobs() OWNER TO p07_control;
REVOKE ALL ON FUNCTION p07.reap_exhausted_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.reap_exhausted_jobs() TO p07_worker;
