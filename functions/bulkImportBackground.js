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
  
  // Comprehensive logging at entry point
  console.log('\n' + '═'.repeat(80));
  console.log('[IMPORT] 📥 REQUEST RECEIVED');
  console.log('[IMPORT] Time:', new Date().toISOString());
  console.log('[IMPORT] Method:', req.method);
  console.log('═'.repeat(80));
  
  try {
    // Step 1: Authenticate
    console.log('[IMPORT] Step 1: Authenticating user...');
    const user = await base44.auth.me();
    
    if (!user) {
      console.log('[IMPORT] ❌ No authenticated user');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[IMPORT] ✅ User authenticated:', user.email);

    // Step 2: Check developer access
    console.log('[IMPORT] Step 2: Checking developer access...');
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
    
    console.log('[IMPORT] Email check:', user.email, '→', emailMatch ? '✅' : '❌');
    console.log('[IMPORT] Phone check:', user.phone, '→', phoneMatch ? '✅' : '❌');
    
    if (!emailMatch && !phoneMatch) {
      console.log('[IMPORT] ❌ Access denied - not a developer');
      return Response.json({ 
        error: 'Admin access required',
        hint: 'Only developer accounts can run bulk imports'
      }, { status: 403 });
    }
    
    console.log('[IMPORT] ✅ Developer access confirmed');

    // Step 3: Parse request body
    console.log('[IMPORT] Step 3: Parsing request body...');
    const { translations } = await req.json();
    console.log('[IMPORT] Translations requested:', translations);
    
    if (!translations || translations.length === 0) {
      console.log('[IMPORT] ❌ No translations specified');
      return Response.json({ error: 'No translations specified' }, { status: 400 });
    }
    
    console.log('[IMPORT] ✅ Request valid -', translations.length, 'translation(s)');

    // Step 4: Start background task
    console.log('[IMPORT] Step 4: Starting background import task...');
    console.log('[IMPORT] Launching importInBackground() function...');
    
    // Launch background task WITHOUT awaiting it
    importInBackground(base44, translations).catch(error => {
      console.error('[IMPORT] 💥 BACKGROUND TASK CRASHED:', error);
      console.error('[IMPORT] Stack trace:', error.stack);
    });
    
    console.log('[IMPORT] ✅ Background task launched successfully');
    console.log('[IMPORT] 📤 Returning success response to client');
    console.log('═'.repeat(80) + '\n');

    // Return immediately
    return Response.json({
      success: true,
      message: 'Import started in background',
      translations: translations,
      total_chapters: translations.length * 1189,
      status: 'processing',
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

async function importInBackground(base44, translations) {
  const stats = { success: 0, failed: 0, cached: 0, skipped: 0 };
  const startTime = Date.now();
  
  console.log('\n' + '█'.repeat(80));
  console.log('[BACKGROUND] 🚀 BACKGROUND IMPORT TASK STARTED');
  console.log('[BACKGROUND] Time:', new Date().toISOString());
  console.log('[BACKGROUND] Translations:', translations.join(', '));
  console.log('[BACKGROUND] Total chapters:', translations.length * 1189);
  console.log('█'.repeat(80));

  for (let transIndex = 0; transIndex < translations.length; transIndex++) {
    const translationId = translations[transIndex];
    
    console.log('\n' + '─'.repeat(80));
    console.log(`[BACKGROUND] 📖 [${transIndex + 1}/${translations.length}] Starting ${translationId}...`);
    console.log('─'.repeat(80));
    
    let translationStats = { success: 0, failed: 0, cached: 0, skipped: 0 };

    for (let bookIndex = 0; bookIndex < BIBLE_BOOKS.length; bookIndex++) {
      const book = BIBLE_BOOKS[bookIndex];
      
      console.log(`[BACKGROUND]   📚 [${bookIndex + 1}/${BIBLE_BOOKS.length}] ${book.name} (${book.chapters} chapters)`);
      
      // Process chapters in small batches for reliability
      const batchSize = 3;
      
      for (let startChapter = 1; startChapter <= book.chapters; startChapter += batchSize) {
        const endChapter = Math.min(startChapter + batchSize - 1, book.chapters);
        const chapterPromises = [];

        for (let chapter = startChapter; chapter <= endChapter; chapter++) {
          chapterPromises.push(
            importChapterWithRetry(base44, translationId, book.name, chapter)
          );
        }

        // Wait for batch to complete
        const results = await Promise.allSettled(chapterPromises);
        
        for (let i = 0; i < results.length; i++) {
          const chapter = startChapter + i;
          const result = results[i];
          
          if (result.status === 'fulfilled') {
            if (result.value.cached) {
              translationStats.cached++;
              stats.cached++;
            } else if (result.value.success) {
              translationStats.success++;
              stats.success++;
              console.log(`[BACKGROUND]      ✓ Ch ${chapter}`);
            } else if (result.value.skipped) {
              translationStats.skipped++;
              stats.skipped++;
            } else {
              translationStats.failed++;
              stats.failed++;
              console.log(`[BACKGROUND]      ✗ Ch ${chapter}`);
            }
          } else {
            translationStats.failed++;
            stats.failed++;
            console.log(`[BACKGROUND]      ✗ Ch ${chapter} (${result.reason?.message})`);
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n[BACKGROUND] ✅ ${translationId} complete:`);
    console.log(`[BACKGROUND]    Success: ${translationStats.success}`);
    console.log(`[BACKGROUND]    Cached: ${translationStats.cached}`);
    console.log(`[BACKGROUND]    Skipped: ${translationStats.skipped}`);
    console.log(`[BACKGROUND]    Failed: ${translationStats.failed}`);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  console.log('\n' + '█'.repeat(80));
  console.log('[BACKGROUND] 🎉 ALL IMPORTS COMPLETE!');
  console.log(`[BACKGROUND] Duration: ${minutes}m ${seconds}s`);
  console.log(`[BACKGROUND] Total Success: ${stats.success}`);
  console.log(`[BACKGROUND] Total Cached: ${stats.cached}`);
  console.log(`[BACKGROUND] Total Skipped: ${stats.skipped}`);
  console.log(`[BACKGROUND] Total Failed: ${stats.failed}`);
  console.log(`[BACKGROUND] Success Rate: ${Math.round((stats.success + stats.cached) / (stats.success + stats.cached + stats.skipped + stats.failed) * 100)}%`);
  console.log('█'.repeat(80) + '\n');
}

async function importChapterWithRetry(base44, translationId, bookName, chapter, maxRetries = 3) {
  // Check if already cached
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
    console.error(`[BACKGROUND] Cache check error for ${bookName} ${chapter}:`, error.message);
  }

  // Try to import with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const verses = await fetchFromAPI(translationId, bookName, chapter);
      
      if (verses.length === 0) {
        return { success: false, cached: false, skipped: true };
      }

      // Store in database
      const verseRecords = verses.map(v => ({
        translation_id: translationId,
        book_name: bookName,
        chapter: chapter,
        verse: v.verse,
        text: v.text,
        source_hash: `${translationId}-${bookName}-${chapter}-${v.verse}`
      }));

      // Insert in batches
      const batchSize = 10;
      for (let i = 0; i < verseRecords.length; i += batchSize) {
        const batch = verseRecords.slice(i, i + batchSize);
        await base44.asServiceRole.entities.Verse.bulkCreate(batch);
      }

      return { success: true, cached: false };

    } catch (error) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return { success: false, cached: false, skipped: true };
      }

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        return { success: false, cached: false, skipped: false };
      }
    }
  }

  return { success: false, cached: false, skipped: false };
}

async function fetchFromAPI(translationId, bookName, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const encodedBook = encodeURIComponent(bookName);
    const url = `https://bible-api.com/${encodedBook}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith Bible App/1.0',
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
      throw new Error('Request timed out');
    }
    throw error;
  }
}