// Offline Bible Storage Service using IndexedDB

const DB_NAME = 'SermonSmithBible';
const DB_VERSION = 1;
const TRANSLATIONS_STORE = 'translations';
const CHAPTERS_STORE = 'chapters';
const META_STORE = 'downloadMeta';

let db = null;

// Initialize IndexedDB
export async function initOfflineDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Store for translation metadata
      if (!database.objectStoreNames.contains(TRANSLATIONS_STORE)) {
        database.createObjectStore(TRANSLATIONS_STORE, { keyPath: 'id' });
      }
      
      // Store for chapter content
      if (!database.objectStoreNames.contains(CHAPTERS_STORE)) {
        const chaptersStore = database.createObjectStore(CHAPTERS_STORE, { keyPath: 'key' });
        chaptersStore.createIndex('translationId', 'translationId', { unique: false });
      }
      
      // Store for download progress/meta
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'translationId' });
      }
    }
  });
}

// Get a chapter key for storage
function getChapterKey(translationId, bookCode, chapter) {
  return `${translationId}:${bookCode}:${chapter}`;
}

// Save a chapter to offline storage
export async function saveChapterOffline(translationId, bookCode, chapter, data) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAPTERS_STORE], 'readwrite');
    const store = transaction.objectStore(CHAPTERS_STORE);
    
    const record = {
      key: getChapterKey(translationId, bookCode, chapter),
      translationId,
      bookCode,
      chapter,
      data,
      savedAt: new Date().toISOString()
    };
    
    const request = store.put(record);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Get a chapter from offline storage
export async function getChapterOffline(translationId, bookCode, chapter) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAPTERS_STORE], 'readonly');
    const store = transaction.objectStore(CHAPTERS_STORE);
    
    const key = getChapterKey(translationId, bookCode, chapter);
    const request = store.get(key);
    
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.data);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Save translation metadata
export async function saveTranslationMeta(translation) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRANSLATIONS_STORE], 'readwrite');
    const store = transaction.objectStore(TRANSLATIONS_STORE);
    
    const request = store.put({
      ...translation,
      downloadedAt: new Date().toISOString()
    });
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Get all downloaded translations
export async function getDownloadedTranslations() {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRANSLATIONS_STORE], 'readonly');
    const store = transaction.objectStore(TRANSLATIONS_STORE);
    
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Check if a translation is downloaded
export async function isTranslationDownloaded(translationId) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRANSLATIONS_STORE], 'readonly');
    const store = transaction.objectStore(TRANSLATIONS_STORE);
    
    const request = store.get(translationId);
    
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get download progress
export async function getDownloadProgress(translationId) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([META_STORE], 'readonly');
    const store = transaction.objectStore(META_STORE);
    
    const request = store.get(translationId);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Update download progress
export async function updateDownloadProgress(translationId, downloaded, total, status = 'downloading') {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([META_STORE], 'readwrite');
    const store = transaction.objectStore(META_STORE);
    
    const request = store.put({
      translationId,
      downloaded,
      total,
      status,
      percentage: Math.round((downloaded / total) * 100),
      updatedAt: new Date().toISOString()
    });
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Delete a downloaded translation
export async function deleteTranslation(translationId) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRANSLATIONS_STORE, CHAPTERS_STORE, META_STORE], 'readwrite');
    
    // Delete translation meta
    transaction.objectStore(TRANSLATIONS_STORE).delete(translationId);
    
    // Delete download progress
    transaction.objectStore(META_STORE).delete(translationId);
    
    // Delete all chapters for this translation
    const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
    const index = chaptersStore.index('translationId');
    const request = index.openCursor(IDBKeyRange.only(translationId));
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

// Get storage size estimate
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
      usedMB: Math.round((estimate.usage || 0) / (1024 * 1024) * 10) / 10,
      quotaMB: Math.round((estimate.quota || 0) / (1024 * 1024))
    };
  }
  return { used: 0, quota: 0, usedMB: 0, quotaMB: 0 };
}

// Check if we're online
export function isOnline() {
  return navigator.onLine;
}

// Count chapters for a translation
export async function countDownloadedChapters(translationId) {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CHAPTERS_STORE], 'readonly');
    const store = transaction.objectStore(CHAPTERS_STORE);
    const index = store.index('translationId');
    
    const request = index.count(IDBKeyRange.only(translationId));
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export default {
  initOfflineDB,
  saveChapterOffline,
  getChapterOffline,
  saveTranslationMeta,
  getDownloadedTranslations,
  isTranslationDownloaded,
  getDownloadProgress,
  updateDownloadProgress,
  deleteTranslation,
  getStorageEstimate,
  isOnline,
  countDownloadedChapters
};
