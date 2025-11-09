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

// ONLY import KJV - the only reliable translation in bible-api.com
const SUPPORTED_TRANSLATIONS = ['KJV'];

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

    // Check developer access
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
      console.log('[IMPORT] ❌ Access denied - not a developer');
      return Response.json({ 
        error: 'Admin access required',
        hint: 'Only developer accounts can run bulk imports'
      }, { status: 403 });
    }
    
    console.log('[IMPORT] ✅ Developer access confirmed');

    const { translations } = await req.json();
    console.log('[IMPORT] Translations requested:', translations);
    
    if (!translations || translations.length === 0) {
      console.log('[IMPORT] ❌ No translations specified');
      return Response.json({ error: 'No translations specified' }, { status: 400 });
    }
    
    // FILTER: Only import KJV
    const supportedRequested = translations.filter(t => SUPPORTED_TRANSLATIONS.includes(t));
    const unsupported = translations.filter(t => !SUPPORTED_TRANSLATIONS.includes(t));
    
    if (unsupported.length > 0) {
      console.log('[IMPORT] ⚠️ Skipping unsupported translations:', unsupported.join(', '));
    }
    
    if (supportedRequested.length === 0) {
      return Response.json({
        error: 'No supported translations requested',
        hint: 'Currently only KJV is available via bible-api.com',
        unsupported: unsupported
      }, { status: 400 });
    }
    
    console.log('[IMPORT] ✅ Request valid -', supportedRequested.length, 'translation(s)');
    console.log('[IMPORT] 🚀 Launching FAST BATCH import...');
    
    // Launch FAST background task
    importInBackgroundFast(base44, supportedRequested).catch(error => {
      console.error('[IMPORT] 💥 BACKGROUND TASK CRASHED:', error);
      console.error('[IMPORT] Stack trace:', error.stack);
    });
    
    console.log('[IMPORT] ✅ Background task launched');
    console.log('═'.repeat(80) + '\n');

    return Response.json({
      success: true,
      message: 'Fast batch import started (KJV only)',
      translations: supportedRequested,
      skipped: unsupported,
      total_chapters: supportedRequested.length * 1189,
      status: 'processing',
      optimization: 'Fast parallel batching - 10 chapters at once',
      note: 'Check server logs for progress'
    });

  } catch (error) {
    console.error('\n' + '═'.repeat(80));
    console.error('[IMPORT] 💥 FATAL ERROR:', error.message);
    console.error('[IMPORT] Stack:', error.stack);
    console.error('═'.repeat(80) + '\n');
    
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

async function importInBackgroundFast(base44, translations) {
  const stats = { success: 0, failed: 0, cached: 0, skipped: 0 };
  const startTime = Date.now();
  
  console.log('\n' + '█'.repeat(80));
  console.log('[FAST] 🚀 FAST PARALLEL IMPORT STARTED');
  console.log('[FAST] Time:', new Date().toISOString());
  console.log('[FAST] Translations:', translations.join(', '));
  console.log('[FAST] Total chapters:', translations.length * 1189);
  console.log('[FAST] Mode: PARALLEL (10 chapters at once)');
  console.log('█'.repeat(80));

  for (const translationId of translations) {
    console.log(`\n[TRANSLATION] 📖 Starting ${translationId}...`);
    
    try {
      const result = await importTranslationParallel(base44, translationId);
      stats.success += result.success;
      stats.cached += result.cached;
      stats.skipped += result.skipped;
      stats.failed += result.failed;
      
      console.log(`[TRANSLATION] ✅ ${translationId} complete: ✓${result.success} 💾${result.cached} ⊘${result.skipped} ✗${result.failed}`);
    } catch (error) {
      console.error(`[TRANSLATION] ❌ ${translationId} failed:`, error.message);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  console.log('\n' + '█'.repeat(80));
  console.log('[FAST] 🎉 ALL IMPORTS COMPLETE!');
  console.log(`[FAST] Duration: ${minutes}m ${seconds}s`);
  console.log(`[FAST] Total Success: ${stats.success}`);
  console.log(`[FAST] Total Cached: ${stats.cached}`);
  console.log(`[FAST] Total Skipped: ${stats.skipped}`);
  console.log(`[FAST] Total Failed: ${stats.failed}`);
  console.log(`[FAST] Success Rate: ${Math.round((stats.success + stats.cached) / (stats.success + stats.cached + stats.skipped + stats.failed) * 100)}%`);
  console.log('█'.repeat(80) + '\n');
}

async function importTranslationParallel(base44, translationId) {
  const stats = { success: 0, failed: 0, cached: 0, skipped: 0 };
  
  // Process books in parallel batches
  for (const book of BIBLE_BOOKS) {
    const batchSize = 10; // 10 chapters at once
    
    for (let startChapter = 1; startChapter <= book.chapters; startChapter += batchSize) {
      const endChapter = Math.min(startChapter + batchSize - 1, book.chapters);
      const chapterPromises = [];
      
      for (let chapter = startChapter; chapter <= endChapter; chapter++) {
        chapterPromises.push(
          importChapterSmart(base44, translationId, book.name, chapter)
            .then(result => {
              if (result.cached) stats.cached++;
              else if (result.success) stats.success++;
              else if (result.skipped) stats.skipped++;
              else stats.failed++;
              return result;
            })
            .catch(error => {
              stats.failed++;
              console.error(`[ERROR] ${translationId} ${book.name} ${chapter}:`, error.message);
              return { success: false, cached: false, skipped: false };
            })
        );
      }
      
      await Promise.all(chapterPromises);
      console.log(`[BATCH] ${translationId}: ${book.name} ${startChapter}-${endChapter} done (✓${stats.success} 💾${stats.cached} ⊘${stats.skipped} ✗${stats.failed})`);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return stats;
}

async function importChapterSmart(base44, translationId, bookName, chapter) {
  // Quick cache check
  try {
    const cached = await base44.asServiceRole.entities.Verse.filter({
      translation_id: translationId,
      book_name: bookName,
      chapter: chapter
    }, 'verse', 1);

    if (cached.length > 0) {
      return { success: true, cached: true };
    }
  } catch (error) {
    // Continue to fetch if cache check fails
  }

  // Fetch with 1 retry only
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const verses = await fetchFromAPIWithRetry(translationId, bookName, chapter, attempt);
      
      if (verses.length === 0) {
        return { success: false, cached: false, skipped: true };
      }

      // Store verses
      await storeBatch(base44, verses, translationId, bookName, chapter);
      return { success: true, cached: false };

    } catch (error) {
      // Don't retry 404s
      if (error.message.includes('404') || error.message.includes('not found')) {
        return { success: false, cached: false, skipped: true };
      }

      // Only 1 retry
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  return { success: false, cached: false, skipped: false };
}

async function storeBatch(base44, verses, translationId, bookName, chapter) {
  const verseRecords = verses.map(v => ({
    translation_id: translationId,
    book_name: bookName,
    chapter: chapter,
    verse: v.verse,
    text: v.text,
    source_hash: `${translationId}-${bookName}-${chapter}-${v.verse}`
  }));

  // Insert in batches
  const batchSize = 20;
  for (let i = 0; i < verseRecords.length; i += batchSize) {
    const batch = verseRecords.slice(i, i + batchSize);
    await base44.asServiceRole.entities.Verse.bulkCreate(batch);
  }
}

async function fetchFromAPIWithRetry(translationId, bookName, chapter, attempt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const encodedBook = encodeURIComponent(bookName);
    const url = `https://bible-api.com/${encodedBook}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith Bible App/2.0',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('404 - Not found');
      }
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    let verses = [];
    
    if (data.verses && Array.isArray(data.verses)) {
      verses = data.verses.map(v => ({
        verse: v.verse,
        text: v.text
      }));
    } else if (data.text) {
      const verseMatch = data.reference?.match(/:(\d+)/);
      const verseNumber = verseMatch ? parseInt(verseMatch[1]) : 1;
      
      verses = [{
        verse: verseNumber,
        text: data.text
      }];
    }

    return verses;

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds');
    }
    throw error;
  }
}