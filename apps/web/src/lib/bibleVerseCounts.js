/**
 * Per-chapter verse counts — thin re-export.
 *
 * The canonical KJV/Protestant versification table lives in
 * `@sermonsmith/shared/scripture` (single source of truth shared with the
 * API). This shim preserves the historical `@/lib/bibleVerseCounts` import
 * path used across the reader components.
 */
export {
  VERSE_COUNTS,
  versesInChapter,
  chaptersInBook,
} from '@sermonsmith/shared/scripture';
