import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WORKER START] Import worker initialization requested by:', user.email);

    // Get enabled translations
    const translations = await base44.asServiceRole.entities.Translation.filter({ enabled: true });
    
    if (translations.length === 0) {
      return Response.json({ error: 'No enabled translations found' }, { status: 400 });
    }

    console.log(`[WORKER START] Found ${translations.length} enabled translations`);

    // Check for existing jobs
    const existingJobs = await base44.asServiceRole.entities.ImportJob.filter({});
    
    // Create jobs for any missing translations
    const existingTranslationIds = new Set(existingJobs.map(j => j.translation_id));
    const newJobs = [];
    
    for (const trans of translations) {
      if (!existingTranslationIds.has(trans.id)) {
        newJobs.push({
          translation_id: trans.id,
          status: 'pending',
          retries: 0,
          progress: {
            total_chapters_imported: 0,
            total_verses_imported: 0,
            books_completed: []
          },
          error_log: []
        });
      }
    }

    if (newJobs.length > 0) {
      await base44.asServiceRole.entities.ImportJob.bulkCreate(newJobs);
      console.log(`[WORKER START] Created ${newJobs.length} new import jobs`);
    }

    // Reset any stalled jobs (in_progress for more than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();
    const stalledJobs = existingJobs.filter(j => 
      j.status === 'in_progress' && 
      (!j.last_heartbeat || j.last_heartbeat < tenMinutesAgo)
    );

    for (const job of stalledJobs) {
      await base44.asServiceRole.entities.ImportJob.update(job.id, {
        status: 'retrying',
        retries: job.retries + 1
      });
      console.log(`[WORKER START] Reset stalled job: ${job.translation_id}`);
    }

    // Start the worker (non-blocking)
    runWorker(base44).catch(err => {
      console.error('[WORKER] Fatal error:', err);
    });

    return Response.json({
      success: true,
      message: 'Import worker started',
      translations: translations.length,
      newJobs: newJobs.length,
      stalledReset: stalledJobs.length
    });

  } catch (error) {
    console.error('[WORKER START] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function runWorker(base44) {
  console.log('\n' + '█'.repeat(80));
  console.log('[WORKER] 🚀 RESILIENT IMPORT WORKER STARTED');
  console.log('█'.repeat(80));

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

  let watchdogTimer = Date.now();
  
  while (true) {
    try {
      // Get next pending or retrying job
      const jobs = await base44.asServiceRole.entities.ImportJob.filter({});
      const nextJob = jobs.find(j => j.status === 'pending' || j.status === 'retrying');

      if (!nextJob) {
        const completedCount = jobs.filter(j => j.status === 'completed').length;
        const failedCount = jobs.filter(j => j.status === 'failed').length;
        
        if (completedCount + failedCount === jobs.length) {
          console.log('[WORKER] ✅ ALL JOBS COMPLETE');
          console.log(`[WORKER] Completed: ${completedCount}, Failed: ${failedCount}`);
          
          // Run validation
          await validateAllTranslations(base44, jobs);
          break;
        }

        // Check for stalled jobs
        const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();
        const stalledJob = jobs.find(j => 
          j.status === 'in_progress' && 
          (!j.last_heartbeat || j.last_heartbeat < tenMinutesAgo)
        );

        if (stalledJob) {
          console.log(`[WORKER] 🔄 Restarting stalled job: ${stalledJob.translation_id}`);
          await base44.asServiceRole.entities.ImportJob.update(stalledJob.id, {
            status: 'retrying',
            retries: stalledJob.retries + 1
          });
          continue;
        }

        // Wait and check again
        await sleep(5000);
        continue;
      }

      // Check retry limit
      if (nextJob.retries >= 5) {
        console.log(`[WORKER] ❌ Max retries reached for ${nextJob.translation_id}`);
        await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
          status: 'failed',
          error_log: [...(nextJob.error_log || []), {
            timestamp: new Date().toISOString(),
            error: 'Max retries exceeded'
          }]
        });
        continue;
      }

      // Process this job
      console.log(`[WORKER] 📥 Processing: ${nextJob.translation_id} (attempt ${nextJob.retries + 1}/5)`);
      
      await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
        status: 'in_progress',
        started_at: nextJob.started_at || new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      });

      watchdogTimer = Date.now();

      // Import with resilience
      const result = await importTranslationResilient(base44, nextJob, BIBLE_BOOKS);

      if (result.success) {
        await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          progress: result.progress
        });
        console.log(`[WORKER] ✅ ${nextJob.translation_id} completed`);
      } else {
        const backoffMs = Math.min(60000, 2000 * Math.pow(2, nextJob.retries));
        console.log(`[WORKER] ⚠️ ${nextJob.translation_id} failed, backing off ${backoffMs}ms`);
        
        await base44.asServiceRole.entities.ImportJob.update(nextJob.id, {
          status: 'retrying',
          retries: nextJob.retries + 1,
          last_heartbeat: new Date().toISOString(),
          error_log: [...(nextJob.error_log || []), {
            timestamp: new Date().toISOString(),
            error: result.error
          }]
        });

        await sleep(backoffMs);
      }

      // Watchdog check
      if (Date.now() - watchdogTimer > 120000) {
        console.log('[WORKER] ⚠️ Watchdog timeout, checking for stalled operations...');
        watchdogTimer = Date.now();
      }

      await sleep(1000); // Rate limiting between translations

    } catch (error) {
      console.error('[WORKER] Error in main loop:', error);
      await sleep(5000);
    }
  }

  console.log('[WORKER] 🏁 Worker shutdown complete');
}

async function importTranslationResilient(base44, job, BIBLE_BOOKS) {
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

        // Fetch with retry
        const verses = await fetchChapterWithRetry(translationId, book.name, chapter, 3);
        
        if (verses.length === 0) {
          continue; // Skip missing chapters
        }

        // Write with retry
        await writeChapterWithRetry(base44, translationId, book.name, chapter, verses, 3);
        
        totalChapters++;
        totalVerses += verses.length;

        // Small delay to avoid rate limits
        await sleep(150);
      }

      booksCompleted.push(book.name);
      console.log(`[WORKER] ${translationId}: Completed ${book.name} (${totalChapters}/1189 chapters)`);
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

async function fetchChapterWithRetry(translationId, bookName, chapter, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}?translation=${translationId.toLowerCase()}`;
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'SermonSmith/2.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          await sleep(5000 * (i + 1));
          continue;
        }
        return [];
      }

      const data = await response.json();
      
      if (data.verses && Array.isArray(data.verses)) {
        return data.verses.map(v => ({ verse: v.verse, text: v.text }));
      } else if (data.text) {
        return [{ verse: 1, text: data.text }];
      }

      return [];

    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2000 * (i + 1));
    }
  }
  return [];
}

async function writeChapterWithRetry(base44, translationId, bookName, chapter, verses, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
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
      return;

    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(2000 * (i + 1));
    }
  }
}

async function validateAllTranslations(base44, jobs) {
  console.log('\n[VALIDATION] 📊 Starting post-import validation...\n');

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

      const status = chapters.size >= 1189 ? '✅' : '⚠️';
      console.log(`[VALIDATION] ${status} ${job.translation_id}: ${verses.length} verses, ${chapters.size} chapters`);

    } catch (error) {
      console.error(`[VALIDATION] Error validating ${job.translation_id}:`, error);
    }
  }

  console.log('\n[VALIDATION] ✅ Validation complete\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}