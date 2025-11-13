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

// Just import KJV - the most reliable and commonly available
const TRANSLATION = 'KJV';

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

    console.log(`[SimpleBibleImport] Starting KJV import...`);
    
    let totalVerses = 0;
    let totalChapters = 0;
    const startTime = Date.now();

    for (const book of BIBLE_BOOKS) {
      console.log(`[SimpleBibleImport] Importing ${book.name}...`);
      
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        // Check if already exists
        const exists = await base44.asServiceRole.entities.Verse.filter({
          translation_id: TRANSLATION,
          book_name: book.name,
          chapter: chapter
        }, 'id', 1);

        if (exists.length > 0) {
          totalChapters++;
          console.log(`[SimpleBibleImport] ${book.name} ${chapter} already exists, skipping`);
          continue;
        }

        // Fetch from API
        const url = `https://bible-api.com/${encodeURIComponent(book.name)}+${chapter}?translation=kjv`;
        
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
            headers: {
              'User-Agent': 'SermonSmith/2.0',
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            console.log(`[SimpleBibleImport] Failed to fetch ${book.name} ${chapter}: ${response.status}`);
            await sleep(200);
            continue;
          }

          const data = await response.json();
          let verses = [];
          
          if (data.verses && Array.isArray(data.verses)) {
            verses = data.verses.map(v => ({ verse: v.verse, text: v.text }));
          } else if (data.text) {
            verses = [{ verse: 1, text: data.text }];
          }

          if (verses.length === 0) {
            console.log(`[SimpleBibleImport] No verses found for ${book.name} ${chapter}`);
            await sleep(200);
            continue;
          }

          // Save to database
          const records = verses.map(v => ({
            translation_id: TRANSLATION,
            book_name: book.name,
            chapter: chapter,
            verse: v.verse,
            text: v.text,
            source_hash: `${TRANSLATION}-${book.name}-${chapter}-${v.verse}`
          }));

          await base44.asServiceRole.entities.Verse.bulkCreate(records);
          
          totalChapters++;
          totalVerses += verses.length;
          
          console.log(`[SimpleBibleImport] ✅ ${book.name} ${chapter}: ${verses.length} verses (Total: ${totalVerses})`);

        } catch (error) {
          console.log(`[SimpleBibleImport] Error fetching ${book.name} ${chapter}:`, error.message);
        }

        // Rate limiting
        await sleep(150);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[SimpleBibleImport] ✅ Complete! ${totalVerses} verses in ${totalChapters} chapters (${duration}s)`);

    return Response.json({
      success: true,
      translation: TRANSLATION,
      totalVerses,
      totalChapters,
      duration: `${duration} seconds`,
      message: `Successfully imported KJV Bible with ${totalVerses} verses`
    });

  } catch (error) {
    console.error('[SimpleBibleImport] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}