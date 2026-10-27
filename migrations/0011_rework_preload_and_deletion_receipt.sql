-- A new rework session must finish full preload before any new decision body.
ALTER TABLE p07.revision_intents ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE p07.decision_previews ADD COLUMN session_id uuid;
ALTER TABLE p07.decision_previews ADD FOREIGN KEY(owner_id,session_id) REFERENCES p07.agent_sessions(owner_id,id);
CREATE INDEX decision_preview_session ON p07.decision_previews(owner_id,session_id);

-- Keep the single, short-lived deletion receipt login. All business APIs also
-- check account status; CLOSED is authorized only for its deletion receipt.
CREATE OR REPLACE FUNCTION p07.auth_session(p_hash text)
 RETURNS TABLE(owner_id uuid,identity_id uuid,provider text,app_alias text,session_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT s.owner_id,s.identity_id,i.provider,i.app_alias,s.id FROM p07.sessions s
 JOIN p07.platform_identities i ON i.id=s.identity_id AND i.owner_id=s.owner_id JOIN p07.accounts a ON a.id=s.owner_id
 WHERE length(p_hash)=64 AND s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now() AND a.status IN('ACTIVE','DELETION_PENDING','CLOSED')
$$;
ALTER FUNCTION p07.auth_session(text) OWNER TO p07_control;
REVOKE EXECUTE ON FUNCTION p07.auth_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.auth_session(text) TO p07_app;
