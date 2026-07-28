-- Agent mesh: awareness + communication + learning for the two LLM personas
-- (Larry, Arlynn). Two operational-metadata tables:
--
--   agent_messages — notes one agent leaves for another (or 'broadcast');
--     read_by maps agentId -> ISO timestamp. Retention is bounded on write by
--     the service layer (30 days / newest 200 rows), so no TTL job is needed.
--   agent_lessons  — deduplicated lessons derived from telemetry (e.g. "model
--     X failing repeatedly"); the compound unique (author_agent, topic, claim)
--     backs the upsert in recordAgentLesson; consumed_by maps agentId -> ISO
--     timestamp of when a peer had the lesson injected into a run.
--
-- PRIVACY (docs/AI_GUARDRAILS.md): these tables carry ONLY operational
-- metadata — agent/feature ids, failure types, model names, counts. Never
-- user prompts or generated content; the service layer composes bodies
-- itself and caps their length.

CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "from_agent" TEXT NOT NULL,
    "to_agent" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "read_by" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_lessons" (
    "id" TEXT NOT NULL,
    "author_agent" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "evidence" JSONB,
    "times_seen" INTEGER NOT NULL DEFAULT 1,
    "confirmations" JSONB NOT NULL DEFAULT '[]',
    "refutations" JSONB NOT NULL DEFAULT '[]',
    "consumed_by" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_lessons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_messages_to_agent_created_at_idx" ON "agent_messages"("to_agent", "created_at");

CREATE UNIQUE INDEX "agent_lessons_author_agent_topic_claim_key" ON "agent_lessons"("author_agent", "topic", "claim");
CREATE INDEX "agent_lessons_topic_updated_at_idx" ON "agent_lessons"("topic", "updated_at");
