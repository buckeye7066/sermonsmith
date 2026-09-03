-- The legacy promotional phone allowlist must not read from User.profile:
-- profile fields are self-service and therefore untrusted for authorization.
-- This dedicated column is assignable only through an admin-authorized path.
ALTER TABLE "users" ADD COLUMN "promotional_phone" TEXT;

-- Preserve an existing owner/admin promotional phone when it is already tied
-- to an independently trusted account identity. We deliberately do not copy
-- phone values for ordinary accounts because the historical profile field was
-- user-editable. Other phone-based promotions can be assigned by an admin.
UPDATE "users"
SET "promotional_phone" = regexp_replace("profile"->>'phone', '[^0-9]', '', 'g')
WHERE regexp_replace(COALESCE("profile"->>'phone', ''), '[^0-9]', '', 'g')
          IN ('9319981779', '19319981779')
  AND (
    "role" IN ('admin', 'dev')
    OR lower("email") IN (
      'buckeye7066@gmail.com',
      'anyawhite@rocketmail.com',
      'whiterobert1201@icloud.com',
      'tishka1201@icloud.com'
    )
  );
