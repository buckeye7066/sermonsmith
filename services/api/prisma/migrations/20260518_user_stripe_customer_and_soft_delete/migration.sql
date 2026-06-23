-- Add Stripe customer linkage + soft-delete to the users table.
--
-- stripe_customer_id: captured on the first completed checkout so the
-- subscription-cancelled webhook can downgrade the exact account by id instead
-- of matching on email (which silently fails if the user changes their email
-- after subscribing). Unique so one Stripe customer maps to one user.
--
-- deleted_at: account deletion now sets this (and bumps token_version) rather
-- than hard-deleting the row and cascade-wiping the user's sermons/studies.
-- Auth + login reject users with deleted_at set; the data stays recoverable.

ALTER TABLE "users" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
