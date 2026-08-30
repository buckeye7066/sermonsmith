/**
 * BibleDataService - Handles loading Bible data from static JSON files
 * This replaces the old database-based system with fast, local JSON files
 * Data is hosted on GitHub and fetched as needed
 */

import { logError } from '@/lib/logError';

const GITHUB_BASE_URL = 'https://buckeye7066.github.io/Bible-app';

const BIBLE_BOOKS = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 }
];

class BibleDataService {
  constructor() {
    this.cache = new Map();
    this.translations = null;
  }

  /**
   * Load available translations metadata
   */
  async getTranslations() {
    if (this.translations) {
      return this.translations;
    }

    try {
      const response = await fetch(`${GITHUB_BASE_URL}/translations.json`);
      if (!response.ok) {
        // Preserve status / statusText so the catch block below can log
        // a useful, debuggable record rather than just "Error".
        const err = new Error(`translations.json ${response.status} ${response.statusText}`);
        err.status = response.status;
        try { err.data = await response.text(); } catch (e) { console.error('Failed to read response text', e); }
        throw err;
      }
      const data = await response.json();
      this.translations = data.translations;
      return this.translations;
    } catch (error) {
      logError('Error loading translations', error, {
        source: 'BibleDataService',
        url: `${GITHUB_BASE_URL}/translations.json`,
      });
      // Return default KJV if translations.json fails. The previous code
      // also swallowed the error; we keep that behaviour because callers
      // rely on this method *always* returning something usable.
      return [{
        id: "KJV",
        name: "King James Version",
        language: "en",
        premium: false,
        filename: "kjv.json"
      }];
    }
  }

  /**
   * Load a specific book from a translation
   */
  async loadBook(translationId, bookName) {
    const cacheKey = `${translationId}-${bookName}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const translations = await this.getTranslations();
      const translation = translations.find(t => t.id === translationId);
      
      if (!translation) {
        console.warn(`Translation ${translationId} not found`);
        return null;
      }

      // Convert book name to lowercase filename (e.g., "Genesis" -> "genesis.json")
      const bookFilename = bookName.toLowerCase().replace(/\s+/g, '-') + '.json';
      const url = `${GITHUB_BASE_URL}/${translationId.toLowerCase()}/${bookFilename}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${bookName} from ${translationId}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Error loading ${bookName} from ${translationId}:`, error);
      throw error;
    }
  }

  /**
   * Get verses for a specific chapter
   */
  async getVerses(translationId, bookName, chapter) {
    try {
      const bookData = await this.loadBook(translationId, bookName);
      
      if (!bookData || !bookData.chapters) {
        throw new Error(`Book ${bookName} not found in ${translationId}`);
      }

      if (chapter < 1 || chapter > Object.keys(bookData.chapters).length) {
        throw new Error('Invalid chapter number');
      }

      const chapterData = bookData.chapters[chapter.toString()];

      if (!chapterData) {
        return [];
      }

      // Convert to array format expected by Reader
      const verses = Object.entries(chapterData).map(([verseNum, text]) => ({
        book_name: bookName,
        chapter: parseInt(chapter),
        verse: parseInt(verseNum),
        text: text,
        translation_id: translationId
      }));

      return verses.sort((a, b) => a.verse - b.verse);
    } catch (error) {
      console.error('Error getting verses:', error);
      return [];
    }
  }

  /**
   * Search across all verses (for search functionality)
   * Note: This will load all books, so it may be slow for first search
   */
  async searchVerses(translationId, query) {
    try {
      const results = [];
      const searchLower = query.toLowerCase();

      // Search through all books
      for (const book of BIBLE_BOOKS) {
        try {
          const bookData = await this.loadBook(translationId, book.name);
          
          if (!bookData || !bookData.chapters) continue;

          for (const [chapterNum, chapterData] of Object.entries(bookData.chapters)) {
            for (const [verseNum, text] of Object.entries(chapterData)) {
              if (text.toLowerCase().includes(searchLower)) {
                results.push({
                  book_name: book.name,
                  chapter: parseInt(chapterNum),
                  verse: parseInt(verseNum),
                  text: text,
                  translation_id: translationId
                });
              }
            }
          }
        } catch (bookError) {
          console.log(`Could not search ${book.name}:`, bookError.message);
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error('Error searching verses:', error);
      return [];
    }
  }

  /**
   * Get a single verse
   */
  async getVerse(translationId, bookName, chapter, verse) {
    try {
      const bookData = await this.loadBook(translationId, bookName);
      const chapterData = bookData?.chapters?.[chapter.toString()];
      const text = chapterData?.[verse.toString()];
      
      if (!text) return null;
      
      return {
        book_name: bookName,
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        text: text,
        translation_id: translationId
      };
    } catch (error) {
      console.error('Error getting verse:', error);
      return null;
    }
  }

  /**
   * Get list of all books
   */
  getBooks() {
    return BIBLE_BOOKS;
  }

  /**
   * Clear cache (useful for memory management)
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const bibleDataService = new BibleDataService();
export { BIBLE_BOOKS };