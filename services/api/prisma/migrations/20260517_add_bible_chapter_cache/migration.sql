-- Persistent cache of full Bible chapters returned by bible-api.com.
--
-- Each chapter request used to round-trip to bible-api.com on every page
-- view. With moderate Reader traffic that quickly burns the upstream's
-- politeness budget and slows first paint. The cache stores the upstream
-- JSON payload keyed by (translation, book, chapter) and is refreshed
-- after BIBLE_CACHE_TTL_MS (default 30 days) — Bible text doesn't change,
-- but we keep a TTL so a translation correction or a switch in upstream
-- formatting eventually propagates without a manual purge.
--
-- The (translation, book, chapter) compound uniqueness lets the API
-- upsert atomically, and the (translation, book) index keeps lookups by
-- book fast for future "list cached chapters" features.

CREATE TABLE "bible_chapter_cache" (
    "id" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bible_chapter_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bible_chapter_cache_translation_book_chapter_key"
    ON "bible_chapter_cache"("translation", "book", "chapter");

CREATE INDEX "bible_chapter_cache_translation_book_idx"
    ON "bible_chapter_cache"("translation", "book");
