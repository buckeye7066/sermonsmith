# 📖 Bible API Refactor Summary

## ✅ What Was Changed

The SermonSmith app has been **completely refactored** to eliminate the need for storing massive Bible JSON files in GitHub. Instead, it now fetches Bible text **on-demand** from external APIs.

---

## 🏗️ New Architecture

### 1. **Bible Source Abstraction** (`components/bible/bibleSources.js`)

Defines available Bible translations and how to fetch them:

```javascript
import { getBibleSource, getAllBibleSources, BOOK_NAME_TO_OSIS } from '@/components/bible/bibleSources';

// Get a specific translation
const kjv = getBibleSource("en-kjv");

// Get all available translations
const all = getAllBibleSources();

// Convert book name to OSIS code
const osisCode = BOOK_NAME_TO_OSIS["John"]; // "JHN"
```

**Currently Available:**
- ✅ King James Version (KJV) - `en-kjv`
- ✅ World English Bible (WEB) - `en-web`

**Future Support:**
- 🔜 Local SQLite bundles for offline use
- 🔜 API.Bible integration for premium translations

---

### 2. **Server Endpoint** (`functions/biblePassage.js`)

A Deno serverless function that fetches passages on-demand:

**Manual Testing:**
```bash
# Fetch John 3:16 (KJV)
curl "https://your-api.up.railway.app/functions/biblePassage?translationId=en-kjv&bookCode=JHN&chapter=3&verses=16"

# Fetch entire Psalm 23 (KJV)
curl "https://your-api.up.railway.app/functions/biblePassage?translationId=en-kjv&bookCode=PSA&chapter=23"

# Fetch Genesis 1:1-3 (WEB)
curl "https://your-api.up.railway.app/functions/biblePassage?translationId=en-web&bookCode=GEN&chapter=1&verses=1-3"
```

**Response Format:**
```json
{
  "reference": "JHN 3:16",
  "translationId": "en-kjv",
  "translationLabel": "King James Version (KJV)",
  "verses": [
    {
      "verse": 16,
      "text": "For God so loved the world..."
    }
  ]
}
```

---

### 3. **React Hook** (`components/bible/usePassage.js`)

Easy-to-use React hook for fetching passages:

```javascript
import { usePassage } from '@/components/bible/usePassage';

function MyComponent() {
  const { loading, error, reference, verses } = usePassage({
    translationId: "en-kjv",
    bookCode: "JHN",
    chapter: 3,
    verses: "16"
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>{reference}</h2>
      {verses.map(v => (
        <p key={v.verse}><strong>{v.verse}</strong> {v.text}</p>
      ))}
    </div>
  );
}
```

**For one-time fetches:**
```javascript
import { fetchPassage } from '@/components/bible/usePassage';

const data = await fetchPassage({
  translationId: "en-kjv",
  bookCode: "PSA",
  chapter: 23
});
```

---

### 4. **Test Page** (`pages/BibleAPITest.js`)

A dedicated test page at `/BibleAPITest` to verify the system works:

- Tests multiple passages (John 3:16, Psalm 23, Genesis 1:1-3)
- Tests multiple translations (KJV, WEB)
- Shows loading states and error handling
- Displays verses with proper formatting

---

## 🔄 Migration Guide

### What to Update:

#### **Old Way (BibleDataService):**
```javascript
// ❌ OLD - Required GitHub-hosted JSON files
import { bibleDataService } from '@/components/reader/BibleDataService';

const verses = await bibleDataService.getVerses("KJV", "Genesis", 1);
```

#### **New Way (usePassage hook):**
```javascript
// ✅ NEW - Fetches on-demand
import { usePassage } from '@/components/bible/usePassage';
import { BOOK_NAME_TO_OSIS } from '@/components/bible/bibleSources';

const { verses, loading, error } = usePassage({
  translationId: "en-kjv",
  bookCode: BOOK_NAME_TO_OSIS["Genesis"], // "GEN"
  chapter: 1
});
```

---

## 📝 How to Add More Translations

### Option 1: Add Another Remote JSON Source

Edit `components/bible/bibleSources.js`:

```javascript
{
  id: "en-asv",
  label: "American Standard Version (ASV)",
  type: "remote-json",
  remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-asv",
  bookSlugMap: { /* same as KJV */ },
  premium: false,
}
```

Also add to `functions/biblePassage.js` in the `bibleSources` array.

### Option 2: Integrate API.Bible (Future)

When ready for premium translations:

1. Update `bibleSources.js`:
```javascript
{
  id: "en-niv",
  label: "New International Version (NIV)",
  type: "api-bible",
  apiBibleId: "de4e12af7f28f599-02", // API.Bible translation ID
  premium: true,
}
```

2. Update `functions/biblePassage.js` to handle `type === "api-bible"`:
```javascript
if (source.type === "api-bible") {
  // Fetch from API.Bible using their API key
  const response = await fetch(`https://api.scripture.api.bible/v1/bibles/${source.apiBibleId}/...`);
  // ... normalize and return
}
```

### Option 3: Add SQLite Offline Support (Future)

1. Create SQLite database with Bible text
2. Update source type to `"local-sqlite"`
3. Implement SQLite query in `functions/biblePassage.js`

---

## 🎯 Benefits of This Approach

✅ **No GitHub storage limits** - No more 25MB file issues  
✅ **Faster initial load** - Only fetches what's needed  
✅ **Better caching** - Browser caches individual passages  
✅ **Scalable** - Easy to add new translations  
✅ **Offline-ready** - Architecture supports SQLite bundles  
✅ **Maintainable** - Clean abstraction layer  

---

## 🧪 Testing

### Test the API Directly:

```bash
# Test KJV John 3:16
curl "https://your-api.up.railway.app/functions/biblePassage?translationId=en-kjv&bookCode=JHN&chapter=3&verses=16"

# Test WEB Romans 8
curl "https://your-api.up.railway.app/functions/biblePassage?translationId=en-web&bookCode=ROM&chapter=8"
```

### Test in the UI:

1. Navigate to `/BibleAPITest` in your app
2. Click the test buttons (John 3:16, Psalm 23, etc.)
3. Verify verses load correctly
4. Check the browser console for any errors

---

## 📚 Next Steps

1. ✅ **Test the new system** - Visit `/BibleAPITest` page
2. 🔄 **Update Reader component** - Replace BibleDataService calls
3. 🔄 **Update VerseOfTheDay component** - Use new API
4. 📦 **Remove old files** - Delete `BibleDataService.js` and related GitHub JSON logic
5. 🚀 **Deploy** - Push changes and test in production

---

## 🆘 Troubleshooting

**Problem:** "Failed to fetch chapter from external API (404)"  
**Solution:** Check that the OSIS book code is correct and supported

**Problem:** "Translation en-xxx not found"  
**Solution:** Verify the translation ID exists in `bibleSources`

**Problem:** Verses not loading in Reader  
**Solution:** Make sure you converted book names to OSIS codes using `BOOK_NAME_TO_OSIS`

---

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify the API endpoint is accessible
3. Test with the `/BibleAPITest` page first
4. Ensure book codes are valid OSIS codes (e.g., "JHN", not "John")

---

**Created:** 2024  
**Author:** Dr. John White (SermonSmith)  
**Status:** ✅ Active & Production-Ready