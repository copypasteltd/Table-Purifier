-- Small retained summaries never contain source text. Full drafts remain ephemeral.
ALTER TABLE p07.runs ADD COLUMN publication_reservation jsonb, ADD COLUMN result_summary jsonb;
ALTER TABLE p07.runtime_cleanup_jobs ADD COLUMN revoked_at timestamptz;
CREATE INDEX cleanup_unfinished ON p07.runtime_cleanup_jobs(created_at) WHERE status<>'SUCCEEDED';
CREATE INDEX session_idempotency_purge ON p07.idempotency_records(owner_id,session_id);
