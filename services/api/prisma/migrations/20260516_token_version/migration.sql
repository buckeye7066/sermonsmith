-- Add tokenVersion to users.
--
-- All previously issued JWTs carry no `tv` claim, so authenticateToken
-- treats `undefined` as "matches any version" for the migration window.
-- A password change / reset bumps token_version, invalidating any prior
-- token immediately on next request because the new tokens encode the
-- new tv and the middleware refuses tokens whose tv doesn't match.

ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
