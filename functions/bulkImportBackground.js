import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('\n' + '═'.repeat(80));
  console.log('[IMPORT] 📥 REQUEST RECEIVED');
  console.log('[IMPORT] Time:', new Date().toISOString());
  console.log('═'.repeat(80));
  
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      console.log('[IMPORT] ❌ No authenticated user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[IMPORT] ✅ User authenticated:', user.email);

    const devEmails = [
      'buckeye7066@gmail.com',
      'anyawhite@rocketmail.com',
      'whiterobert1201@icloud.com',
      'tishka1201@icloud.com'
    ];
    
    const devPhones = ['9319981779', '+19319981779', '931-998-1779', '(931) 998-1779'];
    const emailMatch = user.email && devEmails.includes(user.email.toLowerCase());
    const phoneMatch = user.phone && devPhones.some(p => 
      user.phone.replace(/[\s\-\(\)]/g, '').includes(p.replace(/[\s\-\(\)\+]/g, ''))
    );
    
    if (!emailMatch && !phoneMatch) {
      console.log('[IMPORT] ❌ Access denied');
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    console.log('[IMPORT] ✅ Developer access confirmed');

    const { translations } = await req.json();
    console.log('[IMPORT] Translations requested:', translations);
    
    if (!translations || translations.length === 0) {
      return Response.json({ error: 'No translations specified' }, { status: 400 });
    }
    
    console.log('[IMPORT] 🚀 Launching AGGRESSIVE IMPORT for ALL translations...');
    
    importAllTranslationsAggressive(base44, translations).catch(error => {
      console.error('[IMPORT] 💥 FATAL:', error);
    });
    
    console.log('[IMPORT] ✅ Background task launched');
    console.log('═'.repeat(80) + '\n');

    return Response.json({
      success: true,
      message: 'Aggressive import started for ALL translations',
      translations: translations,
      total_chapters: translations.length * 1189,
      status: 'processing'
    });

  } catch (error) {
    console.error('[IMPORT] 💥 ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function importAllTranslationsAggressive(base44, translations) {
  const startTime = Date.now();
  
  console.log('\n' + '█'.repeat(80));
  console.log('[AGGRESSIVE] 🚀 STARTING IMPORT FOR ALL TRANSLATIONS');
  console.log('[AGGRESSIVE] Translations:', translations.join(', '));
  console.log('[AGGRESSIVE] Total chapters:', translations.length * 1189);
  console.log('█'.repeat(80));

  for (const translationId of translations) {
    console.log(`\n[TRANS] 📖 ${translationId} - STARTING...`);
    
    const transStats = { success: 0, cached: 0, failed: 0 };
    
    // Process 5 books in parallel
    for (let bookIndex = 0; bookIndex < BIBLE_BOOKS.length; bookIndex += 5) {
      const bookBatch = BIBLE_BOOKS.slice(bookIndex, bookIndex + 5);
      
      await Promise.all(bookBatch.map(async (book) => {
        // Process 10 chapters in parallel per book
        for (let chapterStart = 1; chapterStart <= book.chapters; chapterStart += 10) {
          const chapterEnd = Math.min(chapterStart + 9, book.chapters);
          const chapterPromises = [];
          
          for (let chapter = chapterStart; chapter <= chapterEnd; chapter++) {
            chapterPromises.push(
              importChapter(base44, translationId, book.name, chapter)
                .then(result => {
                  if (result.cached) transStats.cached++;
                  else if (result.success) transStats.success++;
                  else transStats.failed++;
                })
                .catch(() => transStats.failed++)
            );
          }
          
          await Promise.all(chapterPromises);
          console.log(`[BATCH] ${translationId}: ${book.name} ${chapterStart}-${chapterEnd} (✓${transStats.success} 💾${transStats.cached} ✗${transStats.failed})`);
          
          await new Promise(r => setTimeout(r, 300));
        }
      }));
    }
    
    console.log(`[TRANS] ✅ ${translationId} COMPLETE: ✓${transStats.success} 💾${transStats.cached} ✗${transStats.failed}`);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '█'.repeat(80));
  console.log('[AGGRESSIVE] 🎉 ALL IMPORTS COMPLETE!');
  console.log(`[AGGRESSIVE] Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
  console.log('█'.repeat(80) + '\n');
}

async function importChapter(base44, translationId, bookName, chapter) {
  // Check cache
  try {
    const cached = await base44.asServiceRole.entities.Verse.filter({
      translation_id: translationId,
      book_name: bookName,
      chapter: chapter
    }, 'verse', 1);

    if (cached.length > 0) {
      return { success: true, cached: true };
    }
  } catch (e) {}

  // Try to fetch
  try {
    const verses = await fetchFromAPI(translationId, bookName, chapter);
    
    if (verses.length === 0) {
      return { success: false, cached: false };
    }

    await storeBatch(base44, verses, translationId, bookName, chapter);
    return { success: true, cached: false };

  } catch (error) {
    return { success: false, cached: false };
  }
}

async function storeBatch(base44, verses, translationId, bookName, chapter) {
  const records = verses.map(v => ({
    translation_id: translationId,
    book_name: bookName,
    chapter: chapter,
    verse: v.verse,
    text: v.text,
    source_hash: `${translationId}-${bookName}-${chapter}-${v.verse}`
  }));

  const batchSize = 20;
  for (let i = 0; i < records.length; i += batchSize) {
    await base44.asServiceRole.entities.Verse.bulkCreate(records.slice(i, i + batchSize));
  }
}

async function fetchFromAPI(translationId, bookName, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.verses && Array.isArray(data.verses)) {
      return data.verses.map(v => ({ verse: v.verse, text: v.text }));
    } else if (data.text) {
      const verseMatch = data.reference?.match(/:(\d+)/);
      return [{ verse: verseMatch ? parseInt(verseMatch[1]) : 1, text: data.text }];
    }

    return [];

  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}