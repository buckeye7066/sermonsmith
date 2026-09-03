-- Promotional email/phone shortcuts are intentional owner-operated campaign
-- mechanisms, but a registration email is only self-asserted. Keep the email
-- allowlist while requiring an explicit, server-owned grant column.
ALTER TABLE "users" ADD COLUMN "promotional_email" TEXT;

-- This migration is the administrator's one-time approval of accounts that
-- already exist under the historical allowlist. Registration never writes
-- promotional_email, so a later claimant of an unregistered address receives
-- only the normal time-limited signup promotion.
UPDATE "users"
SET "promotional_email" = lower("email")
WHERE "deleted_at" IS NULL
  AND lower("email") IN (
    'buckeye7066@gmail.com',
    'anyawhite@rocketmail.com',
    'whiterobert1201@icloud.com',
    'tishka1201@icloud.com'
  );

-- Older membership imports used email as a display-name fallback. Remove
-- those stored copies so private email addresses cannot appear in group data.
UPDATE "community_group_members" AS membership
SET "user_name" = 'Member'
FROM "users" AS account
WHERE membership."user_id" = account."id"
  AND lower(trim(membership."user_name")) = lower(trim(account."email"));

UPDATE "entities" AS entity
SET "data" = jsonb_set(entity."data", '{user_name}', to_jsonb('Member'::text), true)
FROM "users" AS account
WHERE entity."user_id" = account."id"
  AND entity."type" IN (
    'SharedContent',
    'SharedSermon',
    'CommunityPost',
    'CommunityReply',
    'Comment',
    'SermonRating',
    'SharedPlanRating',
    'GroupMessage',
    'MeetingAttendance'
  )
  AND lower(trim(entity."data"->>'user_name')) = lower(trim(account."email"));

-- Older Reader builds mislabeled database-imported chapters with the same
-- source tag as a provider response and could cache a one-verse result for a
-- single-chapter book. Force those ambiguous cache entries to be rebuilt by
-- the completeness-aware reader path.
DELETE FROM "bible_chapter_cache"
WHERE "payload"->>'source' = 'bible-api-parameterized';
