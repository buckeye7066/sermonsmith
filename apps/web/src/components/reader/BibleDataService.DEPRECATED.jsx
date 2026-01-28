/**
 * ⚠️ DEPRECATED - DO NOT USE
 * 
 * This file is the OLD approach that tried to load entire Bible translations
 * from GitHub-hosted JSON files. It caused problems because:
 * 
 * 1. GitHub has a 25MB file size limit
 * 2. Storing entire Bibles in the repo was inefficient
 * 3. Initial load times were slow
 * 4. Difficult to maintain and update
 * 
 * 🆕 NEW APPROACH:
 * Use the new on-demand Bible API system instead:
 * 
 * import { usePassage } from '@/components/bible/usePassage';
 * 
 * const { verses, loading, error } = usePassage({
 *   translationId: "en-kjv",
 *   bookCode: "JHN",
 *   chapter: 3,
 *   verses: "16"
 * });
 * 
 * See: components/bible/REFACTOR_SUMMARY.md for full migration guide
 */

const GITHUB_BASE_URL = 'https://buckeye7066.github.io/Bible-app';

const BIBLE_BOOKS = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  // ... (truncated for brevity)
];

class BibleDataService {
  constructor() {
    console.warn('⚠️ BibleDataService is DEPRECATED. Use usePassage hook instead.');
    console.warn('See: components/bible/REFACTOR_SUMMARY.md');
    this.cache = new Map();
    this.translations = null;
  }

  async getTranslations() {
    console.warn('⚠️ Use getAllBibleSources() from @/components/bible/bibleSources instead');
    return [];
  }

  async loadBook(translationId, bookName) {
    console.error('⚠️ DEPRECATED: Use usePassage hook instead');
    throw new Error('BibleDataService.loadBook is deprecated. Use usePassage hook.');
  }

  async getVerses(translationId, bookName, chapter) {
    console.error('⚠️ DEPRECATED: Use usePassage hook instead');
    throw new Error('BibleDataService.getVerses is deprecated. Use usePassage hook.');
  }

  async searchVerses(translationId, query) {
    console.error('⚠️ DEPRECATED: Search functionality will be reimplemented');
    throw new Error('BibleDataService.searchVerses is deprecated.');
  }

  async getVerse(translationId, bookName, chapter, verse) {
    console.error('⚠️ DEPRECATED: Use usePassage hook with verses parameter');
    throw new Error('BibleDataService.getVerse is deprecated. Use usePassage hook.');
  }

  getBooks() {
    return BIBLE_BOOKS;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const bibleDataService = new BibleDataService();
export { BIBLE_BOOKS };