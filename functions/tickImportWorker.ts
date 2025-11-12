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
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TICK] ⏰ Import worker tick started');

    // Get all jobs
    const jobs = await base44.asServiceRole.entities.ImportJob.filter({}, '-updated_date');
    
    // Find next job to process
    const nextJob = jobs.find(j => j.status === 'pending' || j.status === 'retrying');

    if (!nextJob) {
      const completedCount = jobs.filter(j => j.status === 'completed').length;
      const failedCount = jobs.filter(j => j.status === 'failed').length;
      
      if (completedCount + failedCount === jobs.length && jobs.length > 0) {
        console.log('[TICK] ✅ ALL JOBS COMPLETE');
        await validateAllTranslations(base44, jobs);
        
        return Response.json({
          status: 'complete',
          completed: completedCount,
          failed: failedCount,
          total: jobs.length
        });
      }

      // Check for stalled jobs (no heartbeat in 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
      const stalledJob = jobs.find(j => 
        j.status === 'in_progress' && 
        (!j.last_heartbeat || j.last_heartbeat < fiveMinutesAgo)
      );

      if (stalledJob) {
        console.log(`[TICK] 🔄 Restarting stalled job: ${stalledJob.translation_id}`);
        await base44.asServiceRole.entities.ImportJob.update(stalledJob.id, {
          status: 'retrying',
          retries: stalledJob.retries + 1
        });
        
        return Response.json({
          status: 'stalled_reset',
          translation: stalledJob.translation_id,
          message: 'Call again to resume'
        });
      }

      console.log('[TICK] ⏸️ No jobs ready, waiting...');
      return Response.json({
        status: 'waiting',
        completed: completedCount,
        active: jobs.filter(j => j.status === 'in_progress').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        message: 'No jobs ready to process'
      });
    }

    // Check retry limit
    if (nextJob.retries >= 5) {
      console.log(`[TICK] ❌ Max retries for ${nextJob.translation_id}`);
      await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
        status: 'failed',
        error_log: [...(nextJob.error_log || []), {
          timestamp: new Date().toISOString(),
          error: 'Max retries exceeded'
        }]
      });
      
      return Response.json({
        status: 'failed',
        translation: nextJob.translation_id,
        message: 'Max retries exceeded, moving to next'
      });
    }

    // Start processing
    console.log(`[TICK] 📥 Processing: ${nextJob.translation_id} (attempt ${nextJob.retries + 1}/5)`);
    
    await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
      status: 'in_progress',
      started_at: nextJob.started_at || new Date().toISOString(),
      last_heartbeat: new Date().toISOString()
    });

    // Import this translation (blocking, but limited to ~4 minutes)
    const result = await importTranslation(base44, nextJob, BIBLE_BOOKS);

    if (result.success) {
      await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        progress: result.progress
      });
      
      console.log(`[TICK] ✅ ${nextJob.translation_id} completed: ${result.progress.total_verses_imported} verses`);
      
      return Response.json({
        status: 'completed',
        translation: nextJob.translation_id,
        verses: result.progress.total_verses_imported,
        chapters: result.progress.total_chapters_imported,
        message: 'Translation completed successfully'
      });
    } else {
      const backoffMs = Math.min(60000, 2000 * Math.pow(2, nextJob.retries));
      
      await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
        status: 'retrying',
        retries: nextJob.retries + 1,
        last_heartbeat: new Date().toISOString(),
        error_log: [...(nextJob.error_log || []), {
          timestamp: new Date().toISOString(),
          error: result.error
        }]
      });
      
      console.log(`[TICK] ⚠️ ${nextJob.translation_id} failed: ${result.error}`);
      
      return Response.json({
        status: 'retry',
        translation: nextJob.translation_id,
        error: result.error,
        retries: nextJob.retries + 1,
        backoff_seconds: backoffMs / 1000,
        message: 'Import failed, will retry'
      });
    }

  } catch (error) {
    console.error('[TICK] Error:', error);
    return Response.json({ 
      status: 'error',
      error: error.message 
    }, { status: 500 });
  }
});

async function importTranslation(base44, job, BIBLE_BOOKS) {
  const translationId = job.translation_id;
  let totalChapters = 0;
  let totalVerses = 0;
  const booksCompleted = [];

  try {
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        // Update heartbeat every 10 chapters
        if (totalChapters % 10 === 0) {
          await base44.asServiceRole.entities.ImportJob.update(job.id, {
            last_heartbeat: new Date().toISOString(),
            progress: {
              current_book: book.name,
              current_chapter: chapter,
              total_chapters_imported: totalChapters,
              total_verses_imported: totalVerses,
              books_completed: booksCompleted
            }
          });
        }

        // Check if already exists
        const exists = await base44.asServiceRole.entities.Verse.filter({
          translation_id: translationId,
          book_name: book.name,
          chapter: chapter
        }, 'id', 1);

        if (exists.length > 0) {
          totalChapters++;
          continue;
        }

        // Fetch verses
        const verses = await fetchChapter(translationId, book.name, chapter);
        
        if (verses.length === 0) continue;

        // Write verses
        const records = verses.map(v => ({
          translation_id: translationId,
          book_name: book.name,
          chapter: chapter,
          verse: v.verse,
          text: v.text,
          source_hash: `${translationId}-${book.name}-${chapter}-${v.verse}`
        }));

        await base44.asServiceRole.entities.Verse.bulkCreate(records);
        
        totalChapters++;
        totalVerses += verses.length;

        await sleep(150); // Rate limiting
      }

      booksCompleted.push(book.name);
      console.log(`[TICK] ${translationId}: ${book.name} done (${totalChapters}/1189)`);
    }

    return {
      success: true,
      progress: {
        total_chapters_imported: totalChapters,
        total_verses_imported: totalVerses,
        books_completed: booksCompleted
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
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

    if (!response.ok) return [];

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

async function validateAllTranslations(base44, jobs) {
  console.log('[VALIDATION] 📊 Starting validation...');

  for (const job of jobs) {
    if (job.status !== 'completed') continue;

    try {
      const verses = await base44.asServiceRole.entities.Verse.filter({
        translation_id: job.translation_id
      });

      const chapters = new Set(verses.map(v => `${v.book_name}-${v.chapter}`));
      
      await base44.asServiceRole.entities.ImportJob.update(job.id, {
        validation: {
          expected_chapters: 1189,
          actual_chapters: chapters.size,
          expected_verses: 31102,
          actual_verses: verses.length,
          validated_at: new Date().toISOString()
        }
      });

      console.log(`[VALIDATION] ${job.translation_id}: ${verses.length} verses, ${chapters.size} chapters`);

    } catch (error) {
      console.error(`[VALIDATION] Error validating ${job.translation_id}:`, error);
    }
  }

  console.log('[VALIDATION] ✅ Complete');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}