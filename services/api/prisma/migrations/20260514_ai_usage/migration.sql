-- Persistent per-user / per-day AI usage counter.
--
-- Replaces the previous in-memory Map-based limiter so AI usage caps survive
-- process restarts and apply across multiple replicas. (userId, bucket) is
-- unique so the API can upsert with `ON CONFLICT … DO UPDATE` for atomic
-- increments.

CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_usage_user_id_bucket_key" ON "ai_usage"("user_id", "bucket");
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage"("user_id");
