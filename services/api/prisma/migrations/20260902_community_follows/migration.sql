CREATE TABLE "community_follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_follows_follower_id_following_id_key"
    ON "community_follows"("follower_id", "following_id");

CREATE INDEX "community_follows_following_id_idx"
    ON "community_follows"("following_id");

ALTER TABLE "community_follows"
    ADD CONSTRAINT "community_follows_follower_id_fkey"
    FOREIGN KEY ("follower_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_follows"
    ADD CONSTRAINT "community_follows_following_id_fkey"
    FOREIGN KEY ("following_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
