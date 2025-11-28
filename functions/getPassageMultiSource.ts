import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Translation mappings for different APIs
const SUPERSEARCH_MAP = {
  KJV: "kjv",
  WEB: "web",
  ASV: "asv",
  RST: "synodal"
};

const HELLOAO_MAP = {
  KJV: "KJV",
  WEB: "WEB",
  ASV: "ASV",
  RST: "RST"
};

// Helper to try a source with timeout
async function trySource(urlFn, sourceName, timeoutMs = 8000) {
  try {
    const url = urlFn();
    console.log(`[${sourceName}] Trying: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return { success: true, source: sourceName, data };
  } catch (err) {
    console.log(`[${sourceName}] Failed: ${err.message}`);
    return { success: false, source: sourceName, error: err.message };
  }
}

// Normalization functions
function normalizeBibleApi(result) {
  const { data } = result;
  
  if (!data || !data.verses || data.verses.length === 0) {
    return null;
  }
  
  return {
    success: true,
    source: "bible-api.com",
    reference: data.reference || "",
    translation: (data.translation_id || "KJV").toUpperCase(),
    verses: data.verses.map(v => ({
      verse: v.verse,
      text: (v.text || "").trim()
    }))
  };
}

function normalizeSupersearch(result) {
  const { data } = result;
  
  // BibleSuperSearch returns { results: { ... } } with bible data nested
  if (!data || !data.results) {
    return null;
  }
  
  try {
    const bibleKey = Object.keys(data.results)[0];
    if (!bibleKey) return null;
    
    const bibleData = data.results[bibleKey];
    const verses = [];
    
    // Navigate the nested structure: results -> bible -> book -> chapter -> verses
    for (const bookKey of Object.keys(bibleData)) {
      const book = bibleData[bookKey];
      if (typeof book !== 'object') continue;
      
      for (const chapterKey of Object.keys(book)) {
        const chapter = book[chapterKey];
        if (typeof chapter !== 'object') continue;
        
        for (const verseKey of Object.keys(chapter)) {
          const verseText = chapter[verseKey];
          if (typeof verseText === 'string') {
            verses.push({
              verse: parseInt(verseKey, 10),
              text: verseText.trim()
            });
          }
        }
      }
    }
    
    if (verses.length === 0) return null;
    
    return {
      success: true,
      source: "biblesupersearch",
      reference: data.reference || "",
      translation: bibleKey.toUpperCase(),
      verses: verses.sort((a, b) => a.verse - b.verse)
    };
  } catch (err) {
    console.log("SuperSearch normalization error:", err);
    return null;
  }
}

function normalizeHelloAO(result) {
  const { data } = result;
  
  // HelloAO returns { chapter: { content: [...] } }
  if (!data || !data.chapter || !data.chapter.content) {
    return null;
  }
  
  try {
    const verses = [];
    let currentVerse = null;
    let currentText = "";
    
    for (const item of data.chapter.content) {
      if (item.type === "verse") {
        if (currentVerse !== null && currentText.trim()) {
          verses.push({ verse: currentVerse, text: currentText.trim() });
        }
        currentVerse = item.number;
        currentText = "";
      } else if (item.type === "text" && currentVerse !== null) {
        currentText += item.text;
      }
    }
    
    if (currentVerse !== null && currentText.trim()) {
      verses.push({ verse: currentVerse, text: currentText.trim() });
    }
    
    if (verses.length === 0) return null;
    
    return {
      success: true,
      source: "helloao",
      reference: `${data.book} ${data.chapter.number}`,
      translation: data.translation || "KJV",
      verses
    };
  } catch (err) {
    console.log("HelloAO normalization error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { reference, translation = "KJV" } = await req.json();

    if (!reference) {
      return Response.json({ 
        success: false, 
        error: "Missing reference parameter" 
      }, { status: 400 });
    }

    const encodedRef = encodeURIComponent(reference);
    const trans = translation.toUpperCase();
    const attempts = [];

    // PRIMARY: bible-api.com
    const s1 = await trySource(
      () => `https://bible-api.com/${encodedRef}?translation=${trans.toLowerCase()}`,
      "bible-api.com"
    );
    attempts.push(s1);
    
    if (s1.success) {
      const normalized = normalizeBibleApi(s1);
      if (normalized) {
        return Response.json(normalized);
      }
    }

    // FALLBACK #1: BibleSuperSearch
    const superSearchTrans = SUPERSEARCH_MAP[trans] || trans.toLowerCase();
    const s2 = await trySource(
      () => `https://api.biblesupersearch.com/api?bible=${superSearchTrans}&reference=${encodedRef}&data_format=minimal`,
      "biblesupersearch"
    );
    attempts.push(s2);
    
    if (s2.success) {
      const normalized = normalizeSupersearch(s2);
      if (normalized) {
        return Response.json(normalized);
      }
    }

    // FALLBACK #2: HelloAO (for full chapters only)
    // HelloAO uses a different URL structure - need to parse reference
    const helloaoTrans = HELLOAO_MAP[trans] || trans;
    
    // Try to parse reference like "John 3" or "Genesis 1"
    const refMatch = reference.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
    if (refMatch) {
      const bookName = refMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      const chapter = refMatch[2];
      
      const s3 = await trySource(
        () => `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-${helloaoTrans.toLowerCase()}/books/${bookName}/chapters/${chapter}.json`,
        "helloao"
      );
      attempts.push(s3);
      
      if (s3.success) {
        // This API returns { data: [...] } format
        const { data } = s3;
        if (data && data.data && data.data.length > 0) {
          const seen = new Set();
          const verses = data.data
            .filter(v => {
              const key = `${v.verse}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map(v => ({
              verse: parseInt(v.verse, 10),
              text: v.text
            }));
          
          if (verses.length > 0) {
            return Response.json({
              success: true,
              source: "helloao",
              reference: `${data.data[0].book} ${chapter}`,
              translation: trans,
              verses
            });
          }
        }
      }
    }

    // All sources failed
    return Response.json({
      success: false,
      error: "All Bible sources failed.",
      attempts: attempts.map(a => ({ source: a.source, error: a.error || "Normalization failed" }))
    });

  } catch (err) {
    console.error("[getPassageMultiSource] Error:", err);
    return Response.json({
      success: false,
      error: err.message || "Unknown error"
    }, { status: 500 });
  }
});