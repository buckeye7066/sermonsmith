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

-- Establish only memberships whose authority can be proven from a
-- server-owned column: every StudyGroup Entity's user_id is its creator and
-- therefore its initial leader. Do NOT import legacy GroupMembership JSON.
-- Those rows were historically client-creatable with an arbitrary group_id
-- and role, so treating them as authorization records could promote an
-- attacker to leader of someone else's private group.
INSERT INTO "community_group_members" (
    "id", "group_id", "user_id", "role", "user_name", "joined_at"
)
SELECT
    g."id",
    g."id",
    g."user_id",
    'leader',
    COALESCE(u."full_name", u."name", u."email"),
    g."created_at"
FROM "entities" g
JOIN "users" u ON u."id" = g."user_id"
WHERE g."type" = 'StudyGroup'
ON CONFLICT ("group_id", "user_id") DO NOTHING;
