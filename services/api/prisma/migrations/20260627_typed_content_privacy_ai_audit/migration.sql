-- Typed durable data tables for the Base44 migration completion path.
-- The generic Entity table remains for backward compatibility; these tables
-- let core product data move toward typed, indexed storage gradually.

CREATE TABLE "sermons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "topic" TEXT,
    "anchor_passage" TEXT,
    "search_text" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sermons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sermon_series" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "search_text" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sermon_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sermon_outlines" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sermon_outlines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bible_studies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "search_text" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bible_studies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "study_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "passage" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "search_text" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "study_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "highlights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "passage" TEXT,
    "color" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "passage" TEXT,
    "label" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prayer_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prayer_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_content" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'active',
    "reported_count" INTEGER NOT NULL DEFAULT 0,
    "moderator_notes" TEXT,
    "removed_at" TIMESTAMP(3),
    "removed_by" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shared_content_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forum_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "reported_count" INTEGER NOT NULL DEFAULT 0,
    "moderator_notes" TEXT,
    "removed_at" TIMESTAMP(3),
    "removed_by" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "study_groups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'group',
    "status" TEXT NOT NULL DEFAULT 'active',
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "study_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_content" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_content_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT,
    "prompt_hash" TEXT,
    "response_hash" TEXT,
    "token_estimate" INTEGER,
    "duration_ms" INTEGER,
    "status" TEXT NOT NULL,
    "failure_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bible_translations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_url" TEXT,
    "license" TEXT,
    "attribution" TEXT,
    "copyright_notice" TEXT,
    "public_domain" BOOLEAN NOT NULL DEFAULT false,
    "display_allowed" BOOLEAN NOT NULL DEFAULT true,
    "export_allowed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bible_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bible_passage_cache" (
    "id" TEXT NOT NULL,
    "translation_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "normalized_ref" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bible_passage_cache_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sermon_outlines" ADD CONSTRAINT "sermon_outlines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bible_studies" ADD CONSTRAINT "bible_studies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prayer_requests" ADD CONSTRAINT "prayer_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_content" ADD CONSTRAINT "shared_content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_groups" ADD CONSTRAINT "study_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "community_likes" ADD CONSTRAINT "community_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Common filters
CREATE INDEX "sermons_user_id_idx" ON "sermons"("user_id");
CREATE INDEX "sermons_status_idx" ON "sermons"("status");
CREATE INDEX "sermons_title_idx" ON "sermons"("title");
CREATE INDEX "sermons_created_at_idx" ON "sermons"("created_at");
CREATE INDEX "sermons_updated_at_idx" ON "sermons"("updated_at");
CREATE INDEX "sermons_fts_idx" ON "sermons" USING GIN (to_tsvector('english', coalesce("title",'') || ' ' || coalesce("search_text",'')));

CREATE INDEX "sermon_series_user_id_idx" ON "sermon_series"("user_id");
CREATE INDEX "sermon_series_status_idx" ON "sermon_series"("status");
CREATE INDEX "sermon_series_title_idx" ON "sermon_series"("title");
CREATE INDEX "sermon_series_created_at_idx" ON "sermon_series"("created_at");
CREATE INDEX "sermon_series_updated_at_idx" ON "sermon_series"("updated_at");

CREATE INDEX "sermon_outlines_user_id_idx" ON "sermon_outlines"("user_id");
CREATE INDEX "sermon_outlines_status_idx" ON "sermon_outlines"("status");
CREATE INDEX "sermon_outlines_title_idx" ON "sermon_outlines"("title");
CREATE INDEX "sermon_outlines_created_at_idx" ON "sermon_outlines"("created_at");
CREATE INDEX "sermon_outlines_updated_at_idx" ON "sermon_outlines"("updated_at");

CREATE INDEX "bible_studies_user_id_idx" ON "bible_studies"("user_id");
CREATE INDEX "bible_studies_status_idx" ON "bible_studies"("status");
CREATE INDEX "bible_studies_title_idx" ON "bible_studies"("title");
CREATE INDEX "bible_studies_created_at_idx" ON "bible_studies"("created_at");
CREATE INDEX "bible_studies_updated_at_idx" ON "bible_studies"("updated_at");
CREATE INDEX "bible_studies_fts_idx" ON "bible_studies" USING GIN (to_tsvector('english', coalesce("title",'') || ' ' || coalesce("search_text",'')));

CREATE INDEX "study_notes_user_id_idx" ON "study_notes"("user_id");
CREATE INDEX "study_notes_visibility_idx" ON "study_notes"("visibility");
CREATE INDEX "study_notes_title_idx" ON "study_notes"("title");
CREATE INDEX "study_notes_created_at_idx" ON "study_notes"("created_at");
CREATE INDEX "study_notes_updated_at_idx" ON "study_notes"("updated_at");
CREATE INDEX "study_notes_fts_idx" ON "study_notes" USING GIN (to_tsvector('english', coalesce("title",'') || ' ' || coalesce("search_text",'')));

CREATE INDEX "highlights_user_id_idx" ON "highlights"("user_id");
CREATE INDEX "highlights_passage_idx" ON "highlights"("passage");
CREATE INDEX "highlights_created_at_idx" ON "highlights"("created_at");
CREATE INDEX "highlights_updated_at_idx" ON "highlights"("updated_at");

CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");
CREATE INDEX "bookmarks_passage_idx" ON "bookmarks"("passage");
CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks"("created_at");
CREATE INDEX "bookmarks_updated_at_idx" ON "bookmarks"("updated_at");

CREATE INDEX "prayer_requests_user_id_idx" ON "prayer_requests"("user_id");
CREATE INDEX "prayer_requests_status_idx" ON "prayer_requests"("status");
CREATE INDEX "prayer_requests_visibility_idx" ON "prayer_requests"("visibility");
CREATE INDEX "prayer_requests_created_at_idx" ON "prayer_requests"("created_at");
CREATE INDEX "prayer_requests_updated_at_idx" ON "prayer_requests"("updated_at");

CREATE INDEX "shared_content_user_id_idx" ON "shared_content"("user_id");
CREATE INDEX "shared_content_visibility_idx" ON "shared_content"("visibility");
CREATE INDEX "shared_content_status_idx" ON "shared_content"("status");
CREATE INDEX "shared_content_title_idx" ON "shared_content"("title");
CREATE INDEX "shared_content_created_at_idx" ON "shared_content"("created_at");
CREATE INDEX "shared_content_updated_at_idx" ON "shared_content"("updated_at");

CREATE INDEX "forum_posts_user_id_idx" ON "forum_posts"("user_id");
CREATE INDEX "forum_posts_visibility_idx" ON "forum_posts"("visibility");
CREATE INDEX "forum_posts_status_idx" ON "forum_posts"("status");
CREATE INDEX "forum_posts_title_idx" ON "forum_posts"("title");
CREATE INDEX "forum_posts_created_at_idx" ON "forum_posts"("created_at");
CREATE INDEX "forum_posts_updated_at_idx" ON "forum_posts"("updated_at");

CREATE INDEX "study_groups_user_id_idx" ON "study_groups"("user_id");
CREATE INDEX "study_groups_visibility_idx" ON "study_groups"("visibility");
CREATE INDEX "study_groups_status_idx" ON "study_groups"("status");
CREATE INDEX "study_groups_name_idx" ON "study_groups"("name");
CREATE INDEX "study_groups_created_at_idx" ON "study_groups"("created_at");
CREATE INDEX "study_groups_updated_at_idx" ON "study_groups"("updated_at");

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

CREATE UNIQUE INDEX "community_likes_user_id_content_id_content_type_key" ON "community_likes"("user_id", "content_id", "content_type");
CREATE INDEX "community_likes_content_id_content_type_idx" ON "community_likes"("content_id", "content_type");
CREATE UNIQUE INDEX "saved_content_user_id_content_id_content_type_key" ON "saved_content"("user_id", "content_id", "content_type");
CREATE INDEX "saved_content_content_id_content_type_idx" ON "saved_content"("content_id", "content_type");

CREATE INDEX "ai_audit_logs_user_id_idx" ON "ai_audit_logs"("user_id");
CREATE INDEX "ai_audit_logs_feature_idx" ON "ai_audit_logs"("feature");
CREATE INDEX "ai_audit_logs_status_idx" ON "ai_audit_logs"("status");
CREATE INDEX "ai_audit_logs_created_at_idx" ON "ai_audit_logs"("created_at");

CREATE INDEX "bible_translations_name_idx" ON "bible_translations"("name");
CREATE UNIQUE INDEX "bible_passage_cache_translation_id_normalized_ref_key" ON "bible_passage_cache"("translation_id", "normalized_ref");
CREATE INDEX "bible_passage_cache_translation_id_idx" ON "bible_passage_cache"("translation_id");
CREATE INDEX "bible_passage_cache_reference_idx" ON "bible_passage_cache"("reference");
