/**
 * Bible Passage API Endpoint
 * Fetches Bible passages on-demand from external APIs
 * 
 * Query Parameters:
 * - translationId: Bible translation ID (default: "en-kjv")
 * - bookCode: OSIS book code (e.g., "JHN", "GEN")
 * - chapter: Chapter number
 * - verses: Optional verse range (e.g., "16" or "1-5")
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Bible sources configuration
const bibleSources = [
  {
    id: "en-kjv",
    label: "King James Version (KJV)",
    type: "remote-json",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-kjv",
    bookSlugMap: {
      GEN: "genesis", EXO: "exodus", LEV: "leviticus", NUM: "numbers", DEU: "deuteronomy",
      JOS: "joshua", JDG: "judges", RUT: "ruth", "1SA": "1-samuel", "2SA": "2-samuel",
      "1KI": "1-kings", "2KI": "2-kings", "1CH": "1-chronicles", "2CH": "2-chronicles",
      EZR: "ezra", NEH: "nehemiah", EST: "esther", JOB: "job", PSA: "psalms",
      PRO: "proverbs", ECC: "ecclesiastes", SNG: "song-of-solomon", ISA: "isaiah",
      JER: "jeremiah", LAM: "lamentations", EZK: "ezekiel", DAN: "daniel",
      HOS: "hosea", JOL: "joel", AMO: "amos", OBA: "obadiah", JON: "jonah",
      MIC: "micah", NAM: "nahum", HAB: "habakkuk", ZEP: "zephaniah", HAG: "haggai",
      ZEC: "zechariah", MAL: "malachi", MAT: "matthew", MRK: "mark", LUK: "luke",
      JHN: "john", ACT: "acts", ROM: "romans", "1CO": "1-corinthians",
      "2CO": "2-corinthians", GAL: "galatians", EPH: "ephesians", PHP: "philippians",
      COL: "colossians", "1TH": "1-thessalonians", "2TH": "2-thessalonians",
      "1TI": "1-timothy", "2TI": "2-timothy", TIT: "titus", PHM: "philemon",
      HEB: "hebrews", JAS: "james", "1PE": "1-peter", "2PE": "2-peter",
      "1JN": "1-john", "2JN": "2-john", "3JN": "3-john", JUD: "jude", REV: "revelation",
    },
  },
  {
    id: "en-web",
    label: "World English Bible (WEB)",
    type: "remote-json",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-web",
    bookSlugMap: {
      GEN: "genesis", EXO: "exodus", LEV: "leviticus", NUM: "numbers", DEU: "deuteronomy",
      JOS: "joshua", JDG: "judges", RUT: "ruth", "1SA": "1-samuel", "2SA": "2-samuel",
      "1KI": "1-kings", "2KI": "2-kings", "1CH": "1-chronicles", "2CH": "2-chronicles",
      EZR: "ezra", NEH: "nehemiah", EST: "esther", JOB: "job", PSA: "psalms",
      PRO: "proverbs", ECC: "ecclesiastes", SNG: "song-of-solomon", ISA: "isaiah",
      JER: "jeremiah", LAM: "lamentations", EZK: "ezekiel", DAN: "daniel",
      HOS: "hosea", JOL: "joel", AMO: "amos", OBA: "obadiah", JON: "jonah",
      MIC: "micah", NAM: "nahum", HAB: "habakkuk", ZEP: "zephaniah", HAG: "haggai",
      ZEC: "zechariah", MAL: "malachi", MAT: "matthew", MRK: "mark", LUK: "luke",
      JHN: "john", ACT: "acts", ROM: "romans", "1CO": "1-corinthians",
      "2CO": "2-corinthians", GAL: "galatians", EPH: "ephesians", PHP: "philippians",
      COL: "colossians", "1TH": "1-thessalonians", "2TH": "2-thessalonians",
      "1TI": "1-timothy", "2TI": "2-timothy", TIT: "titus", PHM: "philemon",
      HEB: "hebrews", JAS: "james", "1PE": "1-peter", "2PE": "2-peter",
      "1JN": "1-john", "2JN": "2-john", "3JN": "3-john", JUD: "jude", REV: "revelation",
    },
  },
];

function getBibleSource(id) {
  return bibleSources.find((s) => s.id === id);
}

Deno.serve(async (req) => {
  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // Authenticate user
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers }
      );
    }

    const url = new URL(req.url);
    const translationId = url.searchParams.get("translationId") || "en-kjv";
    const bookCode = url.searchParams.get("bookCode") || "JHN";
    const chapterStr = url.searchParams.get("chapter") || "3";
    const versesParam = url.searchParams.get("verses"); // e.g., "16" or "1-5"
    
    // Check premium access for non-free translations
    const freeSources = ["en-kjv", "en-web"];
    const isPremium = user.subscription_tier === 'premium' || 
                      user.premium_override === true ||
                      (user.premium_until && new Date(user.premium_until) > new Date());
    
    if (!freeSources.includes(translationId) && !isPremium) {
      return new Response(
        JSON.stringify({ 
          error: "Premium subscription required for this translation",
          translationId,
          requiresPremium: true
        }),
        { status: 403, headers }
      );
    }

    const chapter = Number(chapterStr);
    if (Number.isNaN(chapter) || chapter <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid chapter number" }),
        { status: 400, headers }
      );
    }

    const source = getBibleSource(translationId);
    if (!source) {
      return new Response(
        JSON.stringify({ error: `Translation ${translationId} not found` }),
        { status: 404, headers }
      );
    }

    // Handle future SQLite sources
    if (source.type === "local-sqlite") {
      return new Response(
        JSON.stringify({ error: "SQLite sources not yet implemented" }),
        { status: 501, headers }
      );
    }

    // Handle remote-json sources
    if (source.type !== "remote-json" || !source.remoteBaseUrl) {
      return new Response(
        JSON.stringify({ error: "Unsupported translation type" }),
        { status: 400, headers }
      );
    }

    const slug = source.bookSlugMap?.[bookCode];
    if (!slug) {
      return new Response(
        JSON.stringify({ error: `Book code ${bookCode} not supported` }),
        { status: 400, headers }
      );
    }

    // Fetch chapter from remote API
    const chapterUrl = `${source.remoteBaseUrl}/books/${slug}/chapters/${chapter}.json`;
    console.log(`Fetching: ${chapterUrl}`);
    
    const res = await fetch(chapterUrl);
    if (!res.ok) {
      console.error(`Failed to fetch: ${res.status} ${res.statusText}`);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch chapter from external API (${res.status})`,
          bookCode,
          chapter,
          translationId
        }),
        { status: 502, headers }
      );
    }

    const data = await res.json();

    // Normalize verse structure
    const allVerses = Array.isArray(data.verses)
      ? data.verses.map((v) => ({
          verse: Number(v.verse) || 0,
          text: String(v.text || "").trim(),
        }))
      : [];

    // Filter verses if specific range requested
    let filtered = allVerses;
    if (versesParam) {
      const [startStr, endStr] = versesParam.split("-");
      const start = Number(startStr);
      const end = endStr ? Number(endStr) : start;
      if (!Number.isNaN(start) && start > 0) {
        const max = !Number.isNaN(end) && end >= start ? end : start;
        filtered = allVerses.filter((v) => v.verse >= start && v.verse <= max);
      }
    }

    // Build reference string
    const reference =
      versesParam && filtered.length > 0
        ? `${bookCode} ${chapter}:${filtered[0].verse}${
            filtered.length > 1 ? `-${filtered[filtered.length - 1].verse}` : ""
          }`
        : `${bookCode} ${chapter}`;

    const payload = {
      reference,
      translationId,
      translationLabel: source.label,
      verses: filtered,
    };

    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch (err) {
    console.error("bible-passage error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers }
    );
  }
});