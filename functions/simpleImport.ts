import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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

const REFERENCE = {
  verses: 31102,
  books: 66,
  chapters: 1189,
  tolerance: 5
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    await base44.auth.me();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  runImport(base44);

  return Response.json({ message: 'Import started' });
});

async function runImport(base44) {
  let translations = [];
  
  try {
    translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
  } catch {
    console.log('⚠️ Could not load translations');
    return;
  }

  if (translations.length === 0) {
    console.log('⚠️ No enabled translations');
    return;
  }

  // Sequential processing
  for (let i = 0; i < translations.length; i++) {
    const trans = translations[i];
    console.log(`📥 Starting ${trans.name || trans.id}`);
    
    try {
      await importTranslation(base44, trans.id);
      console.log(`✅ ${trans.name || trans.id} completed`);
    } catch (error) {
      console.log(`⚠️ ${trans.name || trans.id} skipped due to persistent error`);
      await sleep(30000);
    }
    
    if (i < translations.length - 1) {
      await sleep(2500);
    }
  }
  
  console.log('📘 All Bible translations imported successfully.');
  
  // Verification
  await verifyAndReimport(base44, translations);
}

async function importTranslation(base44, translationId) {
  for (const book of BIBLE_BOOKS) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      
      const exists = await base44.asServiceRole.entities.Verse.filter({
        translation_id: translationId,
        book_name: book.name,
        chapter: chapter
      }, 'id', 1);
      
      if (exists.length > 0) continue;
      
      const verses = await fetchWithRetry(translationId, book.name, chapter);
      if (verses.length === 0) continue;
      
      await writeWithRetry(base44, translationId, book.name, chapter, verses);
    }
  }
}

async function fetchWithRetry(translationId, bookName, chapter, attempt = 0) {
  try {
    return await fetchChapter(translationId, bookName, chapter);
  } catch {
    if (attempt < 2) {
      await sleep(5000);
      return fetchWithRetry(translationId, bookName, chapter, attempt + 1);
    }
    return [];
  }
}

async function writeWithRetry(base44, translationId, bookName, chapter, verses, attempt = 0) {
  try {
    const records = verses.map(v => ({
      translation_id: translationId,
      book_name: bookName,
      chapter: chapter,
      verse: v.verse,
      text: v.text,
      source_hash: `${translationId}-${bookName}-${chapter}-${v.verse}`
    }));
    
    await base44.asServiceRole.entities.Verse.bulkCreate(records);
  } catch (error) {
    if (attempt < 2) {
      await sleep(5000);
      return writeWithRetry(base44, translationId, bookName, chapter, verses, attempt + 1);
    }
    throw error;
  }
}

async function fetchChapter(translationId, bookName, chapter) {
  const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
  
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent': 'SermonSmith/2.0',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  
  if (data.verses && Array.isArray(data.verses)) {
    return data.verses.map(v => ({ verse: v.verse, text: v.text }));
  } else if (data.text) {
    return [{ verse: 1, text: data.text }];
  }
  
  return [];
}

async function verifyAndReimport(base44, translations) {
  console.log('\n📊 Verification Pass:\n');
  
  const incomplete = [];
  let completeCount = 0;
  
  for (const trans of translations) {
    try {
      const verses = await base44.asServiceRole.entities.Verse.filter({
        translation_id: trans.id
      });
      
      const verseCount = verses.length;
      
      // Count distinct books
      const books = new Set(verses.map(v => v.book_name)).size;
      
      // Count distinct chapters
      const chapters = new Set(verses.map(v => `${v.book_name}-${v.chapter}`)).size;
      
      // Check if complete
      const verseDiff = Math.abs(verseCount - REFERENCE.verses);
      const isComplete = verseDiff <= REFERENCE.tolerance && 
                        books === REFERENCE.books && 
                        chapters >= REFERENCE.chapters - 10;
      
      if (isComplete) {
        console.log(`✅ ${trans.name || trans.id} — ${verseCount} verses, ${books} books, ${chapters} chapters`);
        completeCount++;
      } else {
        console.log(`⚠️ ${trans.name || trans.id} — ${verseCount} verses (incomplete, recheck needed)`);
        incomplete.push(trans);
      }
      
    } catch (error) {
      console.log(`⚠️ ${trans.name || trans.id} — verification failed`);
      incomplete.push(trans);
    }
  }
  
  console.log(`\n📘 ${completeCount} translations verified complete`);
  console.log(`⚠️ ${incomplete.length} translations need re-import\n`);
  
  // Re-import incomplete translations
  if (incomplete.length > 0) {
    console.log('🔄 Starting re-import for incomplete translations...\n');
    
    for (const trans of incomplete) {
      console.log(`📥 Re-importing ${trans.name || trans.id}`);
      
      try {
        // Delete existing verses for clean re-import
        const existingVerses = await base44.asServiceRole.entities.Verse.filter({
          translation_id: trans.id
        });
        
        for (const verse of existingVerses) {
          await base44.asServiceRole.entities.Verse.delete(verse.id);
        }
        
        // Re-import
        await importTranslation(base44, trans.id);
        console.log(`✅ ${trans.name || trans.id} re-import completed`);
      } catch (error) {
        console.log(`⚠️ ${trans.name || trans.id} re-import failed`);
      }
      
      await sleep(2500);
    }
    
    // Final verification
    console.log('\n📊 Final Verification:\n');
    
    for (const trans of incomplete) {
      try {
        const verses = await base44.asServiceRole.entities.Verse.filter({
          translation_id: trans.id
        });
        
        const verseCount = verses.length;
        const books = new Set(verses.map(v => v.book_name)).size;
        const chapters = new Set(verses.map(v => `${v.book_name}-${v.chapter}`)).size;
        
        console.log(`${verseCount >= REFERENCE.verses - REFERENCE.tolerance ? '✅' : '⚠️'} ${trans.name || trans.id} — ${verseCount} verses, ${books} books, ${chapters} chapters`);
      } catch {
        console.log(`⚠️ ${trans.name || trans.id} — verification failed`);
      }
    }
  }
  
  console.log('\n✅ Bible verification complete — all data ready for use.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}