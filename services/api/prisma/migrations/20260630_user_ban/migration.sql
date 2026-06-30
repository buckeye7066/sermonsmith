-- Admin ban support. The admin User Management UI persists a ban through the
-- generic User entity-update path (api.entities.User.update with
-- { is_banned, banned_at }), which writes directly to these columns. Without
-- them, every Ban click threw "Unknown argument is_banned" in prisma.user.update
-- and silently failed. Login and token validation now reject banned accounts.
ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "banned_at" TIMESTAMP(3);
