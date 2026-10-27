ALTER TABLE p07.capability_releases ADD COLUMN settlement_unit text NOT NULL DEFAULT 'CNY_FEN' CHECK(settlement_unit IN ('CNY_FEN','DOUYIN_DIAMOND'));
ALTER TABLE p07.capability_releases ADD COLUMN price_policy jsonb;
CREATE OR REPLACE FUNCTION p07.find_payment_order(p_provider text,p_reference text)
 RETURNS TABLE(owner_id uuid,order_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,p07 AS $$
 SELECT a.owner_id,a.order_id FROM p07.payment_attempts a JOIN p07.orders o ON o.id=a.order_id AND o.owner_id=a.owner_id
 WHERE o.provider=p_provider AND (a.provider_order_ref=p_reference OR a.merchant_reference=p_reference) LIMIT 1
$$;
ALTER FUNCTION p07.find_payment_order(text,text) OWNER TO p07_control;
