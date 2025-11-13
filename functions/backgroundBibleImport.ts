import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const BIBLE_BOOKS = [
  { name: "Genesis", chapters: 50 }, { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 }, { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 }, { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 }, { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 }, { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 }, { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 }, { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 }, { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 }, { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 }, { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 }, { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 }, { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 }, { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 }, { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 }, { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 }, { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 }, { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 }, { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 }, { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 }, { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 }, { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 }, { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 }, { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 }, { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 }, { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 }, { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 }, { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 }, { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 }, { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 }, { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 }, { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 }, { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 }, { name: "Revelation", chapters: 22 }
];

const ALL_TRANSLATIONS = [
  'KJV', 'ASV', 'BBE', 'DARBY', 'WEB', 'YLT', 'ESV', 'NIV', 'NRSV', 'NASB',
  'NLT', 'MSG', 'AMP', 'CEV', 'GNT', 'HCSB', 'ISV', 'NET', 'RSV', 'NKJV',
  'GW', 'TLB', 'ERV', 'EXB', 'ICB', 'NIRV', 'NCV', 'PHILLIPS', 'VOICE', 'CEB',
  'TPT', 'TLV', 'JUB', 'NOG', 'MEV', 'CSB', 'EASY', 'NIVUK', 'RV1885', 'WE',
  'DRA', 'AKJV', 'LEB', 'OJB', 'WYC', 'TCENT', 'LSV', 'BRG', 'GNV', 'RV1895', 'ARASVD'
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden - Admin access required',
        user_email: user.email,
        user_role: user.role
      }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[BackgroundImport] 🚀 Starting import of all ${ALL_TRANSLATIONS.length} translations...`);
  
  // Start the import in the background - don't wait for it
  importAllTranslations(base44);

  return Response.json({
    success: true,
    message: `Started background import of ${ALL_TRANSLATIONS.length} translations`,
    translations: ALL_TRANSLATIONS,
    estimatedTime: '30-45 minutes'
  });
});

async function importAllTranslations(base44) {
  const startTime = Date.now();
  let totalVerses = 0;
  let completedTranslations = 0;
  
  for (const translationId of ALL_TRANSLATIONS) {
    console.log(`\n[BackgroundImport] 📖 Starting ${translationId}...`);
    
    try {
      const verses = await importTranslation(base44, translationId);
      totalVerses += verses;
      completedTranslations++;
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[BackgroundImport] ✅ ${translationId} complete: ${verses} verses (${completedTranslations}/${ALL_TRANSLATIONS.length}) - ${elapsed}s elapsed`);
      
    } catch (error) {
      console.error(`[BackgroundImport] ❌ ${translationId} failed:`, error.message);
      // Continue with next translation even if one fails
    }
    
    // Small delay between translations to avoid overwhelming the API
    await sleep(1000);
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n[BackgroundImport] 🎉 COMPLETE! ${completedTranslations}/${ALL_TRANSLATIONS.length} translations imported`);
  console.log(`[BackgroundImport] 📊 Total: ${totalVerses.toLocaleString()} verses in ${Math.round(duration / 60)} minutes`);
}

async function importTranslation(base44, translationId) {
  let versesImported = 0;
  
  for (const book of BIBLE_BOOKS) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      // Check if already exists
      const exists = await base44.asServiceRole.entities.Verse.filter({
        translation_id: translationId,
        book_name: book.name,
        chapter: chapter
      }, 'id', 1);

      if (exists.length > 0) {
        continue; // Skip if already imported
      }

      // Fetch from API
      const verses = await fetchChapter(translationId, book.name, chapter);
      
      if (verses.length === 0) {
        await sleep(100);
        continue;
      }

      // Save to database
      const records = verses.map(v => ({
        translation_id: translationId,
        book_name: book.name,
        chapter: chapter,
        verse: v.verse,
        text: v.text,
        source_hash: `${translationId}-${book.name}-${chapter}-${v.verse}`
      }));

      try {
        await base44.asServiceRole.entities.Verse.bulkCreate(records);
        versesImported += verses.length;
      } catch (error) {
        console.error(`[BackgroundImport] Error saving ${translationId} ${book.name} ${chapter}:`, error.message);
        // Continue even if save fails
      }

      await sleep(80); // Rate limiting
    }
  }
  
  return versesImported;
}

async function fetchChapter(translationId, bookName, chapter) {
  const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
  
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (data.verses && Array.isArray(data.verses)) {
      return data.verses.map(v => ({ verse: v.verse, text: v.text }));
    } else if (data.text) {
      return [{ verse: 1, text: data.text }];
    }

    return [];
  } catch (error) {
    return [];
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}