import { openDB } from 'idb';

const DB_NAME = 'sermon-smith-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  SERMONS: 'sermons',
  BIBLE_PASSAGES: 'bible-passages',
  USER_CONTENT: 'user-content',
  ASSETS: 'assets'
};

// Initialize the database
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.SERMONS)) {
        db.createObjectStore(STORES.SERMONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.BIBLE_PASSAGES)) {
        db.createObjectStore(STORES.BIBLE_PASSAGES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.USER_CONTENT)) {
        db.createObjectStore(STORES.USER_CONTENT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ASSETS)) {
        db.createObjectStore(STORES.ASSETS, { keyPath: 'url' });
      }
    }
  });
}

/**
 * Cache a sermon for offline viewing
 */
export async function cacheSermon(sermon) {
  try {
    const db = await getDB();
    await db.put(STORES.SERMONS, {
      ...sermon,
      cachedAt: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error caching sermon:', error);
    return false;
  }
}

/**
 * Get a cached sermon
 */
export async function getCachedSermon(id) {
  try {
    const db = await getDB();
    return await db.get(STORES.SERMONS, id);
  } catch (error) {
    console.error('Error getting cached sermon:', error);
    return null;
  }
}

/**
 * Get all cached sermons
 */
export async function getAllCachedSermons() {
  try {
    const db = await getDB();
    return await db.getAll(STORES.SERMONS);
  } catch (error) {
    console.error('Error getting cached sermons:', error);
    return [];
  }
}

/**
 * Cache a Bible passage
 */
export async function cacheBiblePassage(passage) {
  try {
    const db = await getDB();
    await db.put(STORES.BIBLE_PASSAGES, {
      ...passage,
      cachedAt: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error caching Bible passage:', error);
    return false;
  }
}

/**
 * Get a cached Bible passage
 */
export async function getCachedBiblePassage(id) {
  try {
    const db = await getDB();
    return await db.get(STORES.BIBLE_PASSAGES, id);
  } catch (error) {
    console.error('Error getting cached Bible passage:', error);
    return null;
  }
}

/**
 * Cache user's own content (sermons, studies, etc.)
 */
export async function cacheUserContent(content) {
  try {
    const db = await getDB();
    await db.put(STORES.USER_CONTENT, {
      ...content,
      cachedAt: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error caching user content:', error);
    return false;
  }
}

/**
 * Get cached user content
 */
export async function getCachedUserContent(id) {
  try {
    const db = await getDB();
    return await db.get(STORES.USER_CONTENT, id);
  } catch (error) {
    console.error('Error getting cached user content:', error);
    return null;
  }
}

/**
 * Get all cached user content
 */
export async function getAllCachedUserContent() {
  try {
    const db = await getDB();
    return await db.getAll(STORES.USER_CONTENT);
  } catch (error) {
    console.error('Error getting all cached user content:', error);
    return [];
  }
}

/**
 * Cache a static asset
 */
export async function cacheAsset(url, data) {
  try {
    const db = await getDB();
    await db.put(STORES.ASSETS, {
      url,
      data,
      cachedAt: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error caching asset:', error);
    return false;
  }
}

/**
 * Get a cached asset
 */
export async function getCachedAsset(url) {
  try {
    const db = await getDB();
    return await db.get(STORES.ASSETS, url);
  } catch (error) {
    console.error('Error getting cached asset:', error);
    return null;
  }
}

/**
 * Clear old cached items (older than 30 days)
 */
export async function clearOldCache() {
  try {
    const db = await getDB();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    for (const storeName of Object.values(STORES)) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const items = await store.getAll();
      
      for (const item of items) {
        if (item.cachedAt && item.cachedAt < thirtyDaysAgo) {
          await store.delete(item.id || item.url);
        }
      }
      
      await tx.done;
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing old cache:', error);
    return false;
  }
}

/**
 * Clear all cached data
 */
export async function clearAllCache() {
  try {
    const db = await getDB();
    
    for (const storeName of Object.values(STORES)) {
      await db.clear(storeName);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const db = await getDB();
    const stats = {};
    
    for (const [key, storeName] of Object.entries(STORES)) {
      const count = await db.count(storeName);
      stats[key.toLowerCase()] = count;
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}
