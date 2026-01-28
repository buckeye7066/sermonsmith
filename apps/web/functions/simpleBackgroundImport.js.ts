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
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { translations } = await req.json();
    
    if (!translations || translations.length === 0) {
      return Response.json({ error: 'No translations specified' }, { status: 400 });
    }

    console.log(`[SIMPLE IMPORT] Starting for ${translations.length} translations`);

    // Start import in background (don't await)
    importInBackground(base44, translations).catch(err => {
      console.error('[SIMPLE IMPORT] Background error:', err);
    });

    return Response.json({
      success: true,
      message: 'Simple background import started',
      translations: translations.length,
      note: 'Check server logs for progress'
    });

  } catch (error) {
    console.error('[SIMPLE IMPORT] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function importInBackground(base44, translations) {
  console.log('[IMPORT] Background task started');
  
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalCached = 0;

  for (const translationId of translations) {
    console.log(`[IMPORT] Starting ${translationId}`);
    
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        
        try {
          // Check if already exists
          const existing = await base44.asServiceRole.entities.Verse.filter({
            translation_id: translationId,
            book_name: book.name,
            chapter: chapter
          }, 'id', 1);

          if (existing.length > 0) {
            totalCached++;
            if (chapter % 10 === 0) {
              console.log(`[IMPORT] ${translationId} ${book.name} ${chapter} - cached`);
            }
            continue;
          }

          // Fetch from API
          const verses = await fetchChapter(translationId, book.name, chapter);
          
          if (verses.length === 0) {
            console.log(`[IMPORT] ${translationId} ${book.name} ${chapter} - no verses`);
            totalFailed++;
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

          await base44.asServiceRole.entities.Verse.bulkCreate(records);
          totalSuccess++;
          
          console.log(`[IMPORT] ${translationId} ${book.name} ${chapter} - ✓ ${verses.length} verses`);

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 100));

        } catch (error) {
          console.error(`[IMPORT] ${translationId} ${book.name} ${chapter} - ✗ ${error.message}`);
          totalFailed++;
        }
      }
    }
  }

  console.log(`[IMPORT] COMPLETE - ✓${totalSuccess} 💾${totalCached} ✗${totalFailed}`);
}

async function fetchChapter(translationId, bookName, chapter) {
  const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

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