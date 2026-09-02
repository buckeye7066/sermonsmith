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

-- Preserve memberships made through the legacy generic Entity API. Bad or
-- orphaned JSON rows are ignored, and duplicate legacy rows collapse to one.
INSERT INTO "community_group_members" (
    "id", "group_id", "user_id", "role", "user_name", "joined_at"
)
SELECT DISTINCT ON (e.data->>'group_id', e."user_id")
    e."id",
    e.data->>'group_id',
    e."user_id",
    CASE WHEN e.data->>'role' = 'leader' THEN 'leader' ELSE 'member' END,
    COALESCE(NULLIF(e.data->>'user_name', ''), u."full_name", u."name", u."email"),
    e."created_at"
FROM "entities" e
JOIN "users" u ON u."id" = e."user_id"
WHERE e."type" = 'GroupMembership'
  AND NULLIF(e.data->>'group_id', '') IS NOT NULL
ORDER BY e.data->>'group_id', e."user_id", e."created_at"
ON CONFLICT ("group_id", "user_id") DO NOTHING;
