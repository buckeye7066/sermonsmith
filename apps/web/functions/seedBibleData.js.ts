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

// Translations to seed (KJV is free, others are premium)
const TRANSLATIONS_TO_SEED = [
  { id: 'KJV', premium: false },
  { id: 'ESV', premium: true },
  { id: 'NIV', premium: true },
  { id: 'NASB', premium: true },
  { id: 'NLT', premium: true }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('[SEED] Bible data seeding started');
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin/developer
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
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { mode } = await req.json().catch(() => ({ mode: 'all' }));
    
    console.log(`[SEED] Mode: ${mode}`);
    console.log('[SEED] Starting background seeding process...');

    // Start seeding in background
    seedAllTranslations(base44, mode).catch(err => {
      console.error('[SEED] Background error:', err);
    });

    return Response.json({
      success: true,
      message: 'Bible data seeding started in background',
      mode: mode,
      note: 'This will take 2-4 hours. Check server logs for progress.'
    });

  } catch (error) {
    console.error('[SEED] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function seedAllTranslations(base44, mode) {
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalCached = 0;
  let totalFailed = 0;

  console.log('[SEED] ═══════════════════════════════════════');
  console.log('[SEED] BIBLE DATA SEEDING STARTED');
  console.log('[SEED] ═══════════════════════════════════════');

  const translationsToProcess = mode === 'free' 
    ? TRANSLATIONS_TO_SEED.filter(t => !t.premium)
    : TRANSLATIONS_TO_SEED;

  for (const translation of translationsToProcess) {
    console.log(`\n[SEED] ━━━ Starting ${translation.id} (${translation.premium ? 'PREMIUM' : 'FREE'}) ━━━`);
    
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        totalProcessed++;
        
        try {
          // Check if already exists
          const existing = await base44.asServiceRole.entities.Verse.filter({
            translation_id: translation.id,
            book_name: book.name,
            chapter: chapter
          }, 'id', 1);

          if (existing.length > 0) {
            totalCached++;
            continue;
          }

          // Fetch and save
          const verses = await fetchChapter(translation.id, book.name, chapter);
          
          if (verses.length === 0) {
            totalFailed++;
            if (totalProcessed % 50 === 0) {
              console.log(`[SEED] Progress: ${totalProcessed} chapters | ✓${totalSuccess} 💾${totalCached} ✗${totalFailed}`);
            }
            continue;
          }

          const records = verses.map(v => ({
            translation_id: translation.id,
            book_name: book.name,
            chapter: chapter,
            verse: v.verse,
            text: v.text,
            source_hash: `${translation.id}-${book.name}-${chapter}-${v.verse}`
          }));

          await base44.asServiceRole.entities.Verse.bulkCreate(records);
          totalSuccess++;
          
          if (totalProcessed % 50 === 0) {
            console.log(`[SEED] ${translation.id} ${book.name} ${chapter} - ✓ | Progress: ${totalProcessed} chapters | ✓${totalSuccess} 💾${totalCached} ✗${totalFailed}`);
          }

          // Rate limiting
          await new Promise(r => setTimeout(r, 150));

        } catch (error) {
          totalFailed++;
          if (error.message.includes('rate limit') || error.message.includes('429')) {
            console.log(`[SEED] Rate limit hit, waiting 30s...`);
            await new Promise(r => setTimeout(r, 30000));
          }
        }
      }
    }
    
    console.log(`[SEED] ✓ ${translation.id} COMPLETE`);
  }

  const duration = Math.round((Date.now() - startTime) / 1000 / 60);
  
  console.log('\n[SEED] ═══════════════════════════════════════');
  console.log('[SEED] 🎉 SEEDING COMPLETE!');
  console.log(`[SEED] Duration: ${duration} minutes`);
  console.log(`[SEED] Processed: ${totalProcessed} chapters`);
  console.log(`[SEED] Success: ${totalSuccess}`);
  console.log(`[SEED] Cached: ${totalCached}`);
  console.log(`[SEED] Failed: ${totalFailed}`);
  console.log('[SEED] ═══════════════════════════════════════');
}

async function fetchChapter(translationId, bookName, chapter) {
  const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith/2.0',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
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