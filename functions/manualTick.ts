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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  console.log('\n' + '█'.repeat(80));
  console.log('[MANUAL TICK] Starting import tick...');
  console.log('█'.repeat(80));
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get next pending job
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({}, '-updated_date');
    const nextJob = jobs.find(j => j.status === 'pending' || j.status === 'retrying');

    if (!nextJob) {
      const completed = jobs.filter(j => j.status === 'completed').length;
      const failed = jobs.filter(j => j.status === 'failed').length;
      
      return Response.json({
        status: 'no_jobs',
        message: 'No pending jobs found',
        completed: completed,
        failed: failed,
        total: jobs.length
      });
    }

    console.log(`[MANUAL TICK] Processing: ${nextJob.translation_id}`);

    // Mark as in progress
    await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
      status: 'in_progress',
      started_at: nextJob.started_at || new Date().toISOString(),
      last_heartbeat: new Date().toISOString()
    });

    let totalChapters = 0;
    let totalVerses = 0;
    const booksCompleted = [];
    const errors = [];

    // Import all books
    for (const book of BIBLE_BOOKS) {
      console.log(`[MANUAL TICK] ${nextJob.translation_id} - ${book.name}`);
      
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        try {
          // Check if exists
          const exists = await base44.asServiceRole.entities.Verse.filter({
            translation_id: nextJob.translation_id,
            book_name: book.name,
            chapter: chapter
          }, 'id', 1);

          if (exists.length > 0) {
            totalChapters++;
            continue;
          }

          // Fetch verses
          const url = `https://bible-api.com/${encodeURIComponent(book.name)}+${chapter}?translation=${nextJob.translation_id.toLowerCase()}`;
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
            headers: {
              'User-Agent': 'SermonSmith/2.0',
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            if (response.status === 404) {
              continue; // Skip missing chapters
            }
            throw new Error(`API returned ${response.status}`);
          }

          const data = await response.json();
          let verses = [];

          if (data.verses && Array.isArray(data.verses)) {
            verses = data.verses.map(v => ({ verse: v.verse, text: v.text }));
          } else if (data.text) {
            verses = [{ verse: 1, text: data.text }];
          }

          if (verses.length === 0) continue;

          // Write verses
          const records = verses.map(v => ({
            translation_id: nextJob.translation_id,
            book_name: book.name,
            chapter: chapter,
            verse: v.verse,
            text: v.text,
            source_hash: `${nextJob.translation_id}-${book.name}-${chapter}-${v.verse}`
          }));

          await base44.asServiceRole.entities.Verse.bulkCreate(records);
          
          totalChapters++;
          totalVerses += verses.length;

          // Update progress every 50 chapters
          if (totalChapters % 50 === 0) {
            await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
              last_heartbeat: new Date().toISOString(),
              progress: {
                current_book: book.name,
                current_chapter: chapter,
                total_chapters_imported: totalChapters,
                total_verses_imported: totalVerses,
                books_completed: booksCompleted
              }
            });
            console.log(`[MANUAL TICK] Progress: ${totalChapters}/1189 chapters, ${totalVerses} verses`);
          }

          await sleep(150); // Rate limiting

        } catch (error) {
          errors.push({
            book: book.name,
            chapter: chapter,
            error: error.message
          });
          console.error(`[MANUAL TICK] Error ${book.name} ${chapter}:`, error.message);
        }
      }

      booksCompleted.push(book.name);
      console.log(`[MANUAL TICK] ${nextJob.translation_id}: ${book.name} complete (${totalChapters}/1189)`);
    }

    // Mark complete
    await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      progress: {
        total_chapters_imported: totalChapters,
        total_verses_imported: totalVerses,
        books_completed: booksCompleted
      }
    });

    console.log('[MANUAL TICK] ✅ COMPLETE');
    console.log(`[MANUAL TICK] ${nextJob.translation_id}: ${totalVerses} verses, ${totalChapters} chapters`);
    console.log('█'.repeat(80) + '\n');

    return Response.json({
      status: 'completed',
      translation: nextJob.translation_id,
      verses: totalVerses,
      chapters: totalChapters,
      errors: errors.length,
      error_details: errors.slice(0, 10) // First 10 errors
    });

  } catch (error) {
    console.error('[MANUAL TICK] Fatal error:', error);
    return Response.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}