ALTER TABLE p07.field_values ADD COLUMN raw_text text;
ALTER TABLE p07.orders ADD COLUMN reconciliation_required boolean NOT NULL DEFAULT false;
UPDATE p07.privacy_policies SET content_sha256=encode(sha256(convert_to(content::text,'UTF8')),'hex') WHERE content_sha256=repeat('0',64);
