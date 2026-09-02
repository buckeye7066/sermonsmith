CREATE TABLE "community_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "user_name" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_group_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_group_members_group_id_user_id_key"
    ON "community_group_members"("group_id", "user_id");

CREATE INDEX "community_group_members_group_id_idx"
    ON "community_group_members"("group_id");

CREATE INDEX "community_group_members_user_id_idx"
    ON "community_group_members"("user_id");

ALTER TABLE "community_group_members"
    ADD CONSTRAINT "community_group_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Establish leadership only from a server-owned column: every StudyGroup
-- Entity's user_id is its creator and therefore its initial leader. Never
-- trust the legacy membership JSON's role value.
INSERT INTO "community_group_members" (
    "id", "group_id", "user_id", "role", "user_name", "joined_at"
)
SELECT
    g."id",
    g."id",
    g."user_id",
    'leader',
    COALESCE(NULLIF(trim(u."full_name"), ''), NULLIF(trim(u."name"), ''), 'Member'),
    g."created_at"
FROM "entities" g
JOIN "users" u ON u."id" = g."user_id"
WHERE g."type" = 'StudyGroup'
  AND u."deleted_at" IS NULL
ON CONFLICT ("group_id", "user_id") DO NOTHING;

-- Preserve non-owner membership only where doing so cannot disclose private
-- data or grant privilege. A legacy GroupMembership Entity's top-level user_id
-- is server-authenticated ownership, and joining a public group is already
-- open to every entitled member. Therefore those rows can safely become plain
-- `member` records for public groups. Private-group rows and every client-
-- supplied role/user_id field remain intentionally untrusted and are skipped.
INSERT INTO "community_group_members" (
    "id", "group_id", "user_id", "role", "user_name", "joined_at"
)
SELECT
    m."id",
    g."id",
    m."user_id",
    'member',
    COALESCE(NULLIF(trim(u."full_name"), ''), NULLIF(trim(u."name"), ''), 'Member'),
    m."created_at"
FROM "entities" m
JOIN "entities" g
    ON g."id" = m."data"->>'group_id'
   AND g."type" = 'StudyGroup'
JOIN "users" u
    ON u."id" = m."user_id"
   AND u."deleted_at" IS NULL
WHERE m."type" = 'GroupMembership'
  AND m."user_id" <> g."user_id"
  AND COALESCE(g."data"->>'is_private', 'false') = 'false'
ON CONFLICT ("group_id", "user_id") DO NOTHING;

-- A public group whose historical owner was already soft-deleted can be
-- transferred to its earliest safely imported member. Private memberships
-- remain untrusted and therefore cannot be used for this recovery.
WITH replacements AS (
    SELECT DISTINCT ON (gm."group_id")
        gm."group_id",
        gm."user_id"
    FROM "community_group_members" gm
    JOIN "entities" g ON g."id" = gm."group_id" AND g."type" = 'StudyGroup'
    JOIN "users" owner_user ON owner_user."id" = g."user_id"
    WHERE owner_user."deleted_at" IS NOT NULL
    ORDER BY gm."group_id", gm."joined_at" ASC, gm."id" ASC
)
UPDATE "community_group_members" gm
SET "role" = 'leader'
FROM replacements r
WHERE gm."group_id" = r."group_id"
  AND gm."user_id" = r."user_id";

WITH replacements AS (
    SELECT DISTINCT ON (gm."group_id")
        gm."group_id",
        gm."user_id"
    FROM "community_group_members" gm
    JOIN "entities" g ON g."id" = gm."group_id" AND g."type" = 'StudyGroup'
    JOIN "users" owner_user ON owner_user."id" = g."user_id"
    WHERE owner_user."deleted_at" IS NOT NULL
      AND gm."role" = 'leader'
    ORDER BY gm."group_id", gm."joined_at" ASC, gm."id" ASC
)
UPDATE "entities" g
SET "user_id" = r."user_id"
FROM replacements r
WHERE g."id" = r."group_id";

-- No trustworthy successor exists for a remaining ownerless group (notably a
-- private group), so fail closed by hiding it instead of exposing its content
-- or leaving an unreachable active group behind.
UPDATE "entities" g
SET "data" = jsonb_set(
    jsonb_set(g."data", '{status}', '"deleted"'::jsonb, true),
    '{member_count}', '0'::jsonb, true
)
WHERE g."type" = 'StudyGroup'
  AND EXISTS (
      SELECT 1 FROM "users" owner_user
      WHERE owner_user."id" = g."user_id"
        AND owner_user."deleted_at" IS NOT NULL
  )
  AND NOT EXISTS (
      SELECT 1 FROM "community_group_members" gm
      WHERE gm."group_id" = g."id"
        AND gm."role" = 'leader'
  );

-- Keep the denormalized card count aligned with the new relational source of
-- truth immediately at deploy time.
UPDATE "entities" g
SET "data" = jsonb_set(g."data", '{member_count}', to_jsonb(counts."member_count"), true)
FROM (
    SELECT "group_id", COUNT(*)::int AS "member_count"
    FROM "community_group_members"
    GROUP BY "group_id"
) counts
WHERE g."id" = counts."group_id"
  AND g."type" = 'StudyGroup';
