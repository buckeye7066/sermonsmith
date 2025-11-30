// Cache for translation book availability
const translationBooksCache = new Map();

// Old Testament books (order 1-39)
export const OLD_TESTAMENT_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
  "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
  "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi"
];

// New Testament books (order 40-66)
export const NEW_TESTAMENT_BOOKS = [
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
  "Ephesians", "Philippians", "Colossians",
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation"
];

// Known full-Bible translations that should never be marked as NT-only
const FULL_BIBLE_TRANSLATIONS = ['engKJV', 'KJV', 'kjv', 'engASV', 'ASV', 'ENGWEBP', 'WEB', 'BSB'];

// Check if a translation has a specific book
export async function getTranslationBooks(translationId) {
  // Always return full Bible for known complete translations
  if (FULL_BIBLE_TRANSLATIONS.includes(translationId)) {
    const fullBibleInfo = {
      totalBooks: 66,
      hasOT: true,
      hasNT: true,
      isNTOnly: false,
      isOTOnly: false,
      bookIds: [],
      bookNames: []
    };
    translationBooksCache.set(translationId, fullBibleInfo);
    return fullBibleInfo;
  }

  if (translationBooksCache.has(translationId)) {
    return translationBooksCache.get(translationId);
  }

  try {
    const response = await fetch(`https://bible.helloao.org/api/${translationId}/books.json`);
    if (!response.ok) {
      // If API fails, assume full Bible to avoid blocking
      return null;
    }
    
    const data = await response.json();
    const books = data.books || [];
    
    // If no books returned, assume full Bible
    if (books.length === 0) {
      return null;
    }
    
    const bookInfo = {
      totalBooks: books.length,
      hasOT: books.some(b => b.order < 40),
      hasNT: books.some(b => b.order >= 40),
      isNTOnly: books.length > 0 && !books.some(b => b.order < 40),
      isOTOnly: books.length > 0 && !books.some(b => b.order >= 40),
      bookIds: books.map(b => b.id),
      bookNames: books.map(b => b.name)
    };
    
    translationBooksCache.set(translationId, bookInfo);
    return bookInfo;
  } catch (error) {
    console.error('Failed to fetch translation books:', error);
    return null;
  }
}

// Check if a book is available in a translation
export function isBookInTranslation(bookName, translationInfo) {
  if (!translationInfo) return true; // Assume available if we can't check
  
  const isOTBook = OLD_TESTAMENT_BOOKS.includes(bookName);
  const isNTBook = NEW_TESTAMENT_BOOKS.includes(bookName);
  
  if (isOTBook && translationInfo.isNTOnly) return false;
  if (isNTBook && translationInfo.isOTOnly) return false;
  
  return true;
}

// Get first available book for a translation
export function getFirstAvailableBook(translationInfo) {
  if (!translationInfo) return "Genesis";
  if (translationInfo.isNTOnly) return "Matthew";
  if (translationInfo.isOTOnly) return "Genesis";
  return "Genesis";
}

// Clear cache (useful when translations list updates)
export function clearTranslationCache() {
  translationBooksCache.clear();
}