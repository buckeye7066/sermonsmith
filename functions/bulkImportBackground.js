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

    // Developer check
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

    const { translations } = await req.json();
    
    if (!translations || translations.length === 0) {
      return Response.json({ error: 'No translations specified' }, { status: 400 });
    }

    // Start background import (don't await it)
    importInBackground(base44, translations);

    return Response.json({
      message: 'Import started in background',
      translations: translations,
      status: 'processing'
    });

  } catch (error) {
    console.error('Error starting background import:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function importInBackground(base44, translations) {
  const stats = { success: 0, failed: 0, cached: 0 };
  
  console.log(`[IMPORT] Starting background import for ${translations.length} translation(s)`);

  for (const translationId of translations) {
    console.log(`[IMPORT] Starting ${translationId}...`);
    let translationStats = { success: 0, failed: 0, cached: 0 };

    for (const book of BIBLE_BOOKS) {
      // Process multiple chapters concurrently for speed
      const chapterPromises = [];
      const batchSize = 5; // Process 5 chapters at a time

      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        chapterPromises.push(
          importChapter(base44, translationId, book.name, chapter)
        );

        // Process in batches
        if (chapterPromises.length >= batchSize || chapter === book.chapters) {
          const results = await Promise.allSettled(chapterPromises);
          
          for (const result of results) {
            if (result.status === 'fulfilled') {
              if (result.value.cached) {
                translationStats.cached++;
                stats.cached++;
              } else if (result.value.success) {
                translationStats.success++;
                stats.success++;
              } else {
                translationStats.failed++;
                stats.failed++;
              }
            } else {
              translationStats.failed++;
              stats.failed++;
            }
          }

          chapterPromises.length = 0; // Clear array
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`[IMPORT] ${translationId} - ${book.name} complete`);
    }

    console.log(`[IMPORT] Completed ${translationId}: Success=${translationStats.success}, Cached=${translationStats.cached}, Failed=${translationStats.failed}`);
  }

  console.log(`[IMPORT] All imports complete! Total: Success=${stats.success}, Cached=${stats.cached}, Failed=${stats.failed}`);
}

async function importChapter(base44, translationId, bookName, chapter) {
  try {
    // Check cache first
    const cached = await base44.asServiceRole.entities.Verse.filter({
      translation_id: translationId,
      book_name: bookName,
      chapter: chapter
    }, 'verse', 1);

    if (cached.length > 0) {
      return { success: true, cached: true };
    }

    // Fetch from API
    const verses = await fetchFromAPI(translationId, bookName, chapter);
    
    if (verses.length === 0) {
      return { success: false, cached: false };
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
    console.error(`[IMPORT] Error: ${translationId} ${bookName} ${chapter}:`, error.message);
    return { success: false, cached: false };
  }
}

async function fetchFromAPI(translationId, bookName, chapter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const encodedBook = encodeURIComponent(bookName);
    const url = `https://bible-api.com/${encodedBook}+${chapter}?translation=${translationId.toLowerCase()}`;
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'SermonSmith Bible App/1.0'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Handle both possible response formats
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
    throw error;
  }
}