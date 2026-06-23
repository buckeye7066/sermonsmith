-- Free-trial / comp window for the GrantFlow-style "free week / free month"
-- grant. A future timestamp makes the account effectively premium until then;
-- grants set only this column (not `premium`) so access expires automatically.
ALTER TABLE "users" ADD COLUMN "premium_until" TIMESTAMP(3);
