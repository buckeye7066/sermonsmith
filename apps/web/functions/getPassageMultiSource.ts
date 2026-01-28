import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * UNIFIED RESPONSE ENVELOPE:
 * All responses follow: { ok: boolean, error: string|null, data: any }
 */

const SUPERSEARCH_MAP = { KJV: "kjv", WEB: "web", ASV: "asv", RST: "synodal" };
const HELLOAO_MAP = { KJV: "KJV", WEB: "WEB", ASV: "ASV", RST: "RST" };

// Safe fetch with timeout and JSON validation
async function safeFetch(url, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        return { success: false, error: 'API returned HTML instead of JSON' };
      }
      return { success: false, error: 'Invalid content type' };
    }
    
    if (!res.ok) return { success: false, error: `Status ${res.status}` };
    
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Timeout' : err.message };
  }
}

function normalizeBibleApi(result) {
  const { data } = result;
  if (!data || !data.verses || data.verses.length === 0) return null;
  
  return {
    source: "bible-api.com",
    reference: data.reference || "",
    translation: (data.translation_id || "KJV").toUpperCase(),
    verses: data.verses.map(v => ({ verse: v.verse, text: (v.text || "").trim() }))
  };
}

function normalizeSupersearch(result) {
  const { data } = result;
  if (!data || !data.results) return null;
  
  try {
    const bibleKey = Object.keys(data.results)[0];
    if (!bibleKey) return null;
    
    const bibleData = data.results[bibleKey];
    const verses = [];
    
    for (const bookKey of Object.keys(bibleData)) {
      const book = bibleData[bookKey];
      if (typeof book !== 'object') continue;
      
      for (const chapterKey of Object.keys(book)) {
        const chapter = book[chapterKey];
        if (typeof chapter !== 'object') continue;
        
        for (const verseKey of Object.keys(chapter)) {
          const verseText = chapter[verseKey];
          if (typeof verseText === 'string') {
            verses.push({ verse: parseInt(verseKey, 10), text: verseText.trim() });
          }
        }
      }
    }
    
    if (verses.length === 0) return null;
    
    return {
      source: "biblesupersearch",
      reference: data.reference || "",
      translation: bibleKey.toUpperCase(),
      verses: verses.sort((a, b) => a.verse - b.verse)
    };
  } catch {
    return null;
  }
}

async function safeRun(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return { ok: false, error: 'Unauthorized', data: null };
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { reference, translation = "KJV", _selfTest } = body;

  if (_selfTest) {
    return { ok: true, selfTest: true, message: 'getPassageMultiSource is operational', data: null };
  }

  if (!reference) {
    return { ok: false, error: 'Missing reference parameter', data: null };
  }

  const encodedRef = encodeURIComponent(reference);
  const trans = translation.toUpperCase();
  const attempts = [];

  // PRIMARY: bible-api.com
  console.log(`[getPassageMultiSource] Trying bible-api.com for ${reference}`);
  const s1 = await safeFetch(`https://bible-api.com/${encodedRef}?translation=${trans.toLowerCase()}`);
  attempts.push({ source: 'bible-api.com', ...s1 });
  
  if (s1.success) {
    const normalized = normalizeBibleApi(s1);
    if (normalized) {
      return { ok: true, error: null, data: { ...normalized, success: true } };
    }
  }

  // FALLBACK #1: BibleSuperSearch
  console.log(`[getPassageMultiSource] Trying biblesupersearch`);
  const superSearchTrans = SUPERSEARCH_MAP[trans] || trans.toLowerCase();
  const s2 = await safeFetch(`https://api.biblesupersearch.com/api?bible=${superSearchTrans}&reference=${encodedRef}&data_format=minimal`);
  attempts.push({ source: 'biblesupersearch', ...s2 });
  
  if (s2.success) {
    const normalized = normalizeSupersearch(s2);
    if (normalized) {
      return { ok: true, error: null, data: { ...normalized, success: true } };
    }
  }

  // FALLBACK #2: HelloAO CDN
  const refMatch = reference.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
  if (refMatch) {
    const bookName = refMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
    const chapter = refMatch[2];
    const helloaoTrans = HELLOAO_MAP[trans] || trans;
    
    console.log(`[getPassageMultiSource] Trying HelloAO CDN`);
    const s3 = await safeFetch(`https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-${helloaoTrans.toLowerCase()}/books/${bookName}/chapters/${chapter}.json`);
    attempts.push({ source: 'helloao-cdn', ...s3 });
    
    if (s3.success && s3.data?.data?.length > 0) {
      const seen = new Set();
      const verses = s3.data.data
        .filter(v => { const k = `${v.verse}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .map(v => ({ verse: parseInt(v.verse, 10), text: v.text }));
      
      if (verses.length > 0) {
        return {
          ok: true,
          error: null,
          data: {
            success: true,
            source: "helloao-cdn",
            reference: `${s3.data.data[0].book} ${chapter}`,
            translation: trans,
            verses
          }
        };
      }
    }
  }

  return {
    ok: false,
    error: 'All Bible sources failed',
    data: { attempts: attempts.map(a => ({ source: a.source, error: a.error || 'Normalization failed' })) }
  };
}

Deno.serve(async (req) => {
  try {
    const result = await safeRun(req);
    return Response.json(result);
  } catch (err) {
    console.error("[getPassageMultiSource] CRITICAL ERROR:", err);
    return Response.json({
      ok: false,
      error: err?.message ?? "Unknown error",
      data: null
    });
  }
});