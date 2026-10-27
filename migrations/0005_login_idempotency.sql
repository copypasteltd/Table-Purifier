ALTER TABLE p07_meta.login_code_uses ADD COLUMN request_key_hash text;
CREATE UNIQUE INDEX login_action_key ON p07_meta.login_code_uses(provider,app_alias,request_key_hash) WHERE request_key_hash IS NOT NULL;
GRANT UPDATE ON p07_meta.login_code_uses TO p07_control;
CREATE FUNCTION p07.create_platform_login(p_provider text,p_app text,p_subject_hash text,p_subject_cipher text,p_code_hash text,p_token_hash text,p_key_hash text)
 RETURNS TABLE(account_id uuid,identity_id uuid,expires_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 BEGIN
  IF length(p_key_hash)<>64 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_provider||p_app||p_key_hash,0));
  IF EXISTS(SELECT 1 FROM p07_meta.login_code_uses WHERE provider=p_provider AND app_alias=p_app AND request_key_hash=p_key_hash AND code_sha256<>p_code_hash) THEN
   RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN QUERY SELECT * FROM p07.create_platform_login(p_provider,p_app,p_subject_hash,p_subject_cipher,p_code_hash,p_token_hash);
  UPDATE p07_meta.login_code_uses SET request_key_hash=p_key_hash WHERE provider=p_provider AND app_alias=p_app AND code_sha256=p_code_hash;
 END $$;
ALTER FUNCTION p07.create_platform_login(text,text,text,text,text,text,text) OWNER TO p07_control;
REVOKE EXECUTE ON FUNCTION p07.create_platform_login(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p07.create_platform_login(text,text,text,text,text,text,text) TO p07_app;
