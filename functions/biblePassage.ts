/**
 * Bible Passage API Endpoint
 * Fetches Bible passages on-demand from remote sources
 */

// Note: In Deno, we need to import from npm: or use relative paths
// The bibleSources config needs to be accessible here
const bibleSources = [
  {
    id: "en-kjv",
    label: "King James Version (KJV)",
    type: "remote-json",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-kjv",
    premium: false,
    default: true,
    bookSlugMap: {
      GEN: "genesis", EXO: "exodus", LEV: "leviticus", NUM: "numbers",
      DEU: "deuteronomy", JOS: "joshua", JDG: "judges", RUT: "ruth",
      "1SA": "1-samuel", "2SA": "2-samuel", "1KI": "1-kings", "2KI": "2-kings",
      "1CH": "1-chronicles", "2CH": "2-chronicles", EZR: "ezra", NEH: "nehemiah",
      EST: "esther", JOB: "job", PSA: "psalms", PRO: "proverbs",
      ECC: "ecclesiastes", SNG: "song-of-solomon", ISA: "isaiah", JER: "jeremiah",
      LAM: "lamentations", EZK: "ezekiel", DAN: "daniel", HOS: "hosea",
      JOL: "joel", AMO: "amos", OBA: "obadiah", JON: "jonah",
      MIC: "micah", NAM: "nahum", HAB: "habakkuk", ZEP: "zephaniah",
      HAG: "haggai", ZEC: "zechariah", MAL: "malachi", MAT: "matthew",
      MRK: "mark", LUK: "luke", JHN: "john", ACT: "acts",
      ROM: "romans", "1CO": "1-corinthians", "2CO": "2-corinthians", GAL: "galatians",
      EPH: "ephesians", PHP: "philippians", COL: "colossians", "1TH": "1-thessalonians",
      "2TH": "2-thessalonians", "1TI": "1-timothy", "2TI": "2-timothy", TIT: "titus",
      PHM: "philemon", HEB: "hebrews", JAS: "james", "1PE": "1-peter",
      "2PE": "2-peter", "1JN": "1-john", "2JN": "2-john", "3JN": "3-john",
      JUD: "jude", REV: "revelation",
    },
  },
  {
    id: "en-web",
    label: "World English Bible (WEB)",
    type: "remote-json",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-web",
    premium: false,
    bookSlugMap: {
      GEN: "genesis", EXO: "exodus", LEV: "leviticus", NUM: "numbers",
      DEU: "deuteronomy", JOS: "joshua", JDG: "judges", RUT: "ruth",
      "1SA": "1-samuel", "2SA": "2-samuel", "1KI": "1-kings", "2KI": "2-kings",
      "1CH": "1-chronicles", "2CH": "2-chronicles", EZR: "ezra", NEH: "nehemiah",
      EST: "esther", JOB: "job", PSA: "psalms", PRO: "proverbs",
      ECC: "ecclesiastes", SNG: "song-of-solomon", ISA: "isaiah", JER: "jeremiah",
      LAM: "lamentations", EZK: "ezekiel", DAN: "daniel", HOS: "hosea",
      JOL: "joel", AMO: "amos", OBA: "obadiah", JON: "jonah",
      MIC: "micah", NAM: "nahum", HAB: "habakkuk", ZEP: "zephaniah",
      HAG: "haggai", ZEC: "zechariah", MAL: "malachi", MAT: "matthew",
      MRK: "mark", LUK: "luke", JHN: "john", ACT: "acts",
      ROM: "romans", "1CO": "1-corinthians", "2CO": "2-corinthians", GAL: "galatians",
      EPH: "ephesians", PHP: "philippians", COL: "colossians", "1TH": "1-thessalonians",
      "2TH": "2-thessalonians", "1TI": "1-timothy", "2TI": "2-timothy", TIT: "titus",
      PHM: "philemon", HEB: "hebrews", JAS: "james", "1PE": "1-peter",
      "2PE": "2-peter", "1JN": "1-john", "2JN": "2-john", "3JN": "3-john",
      JUD: "jude", REV: "revelation",
    },
  },
];

function getBibleSource(id) {
  return bibleSources.find((s) => s.id === id);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const translationId = url.searchParams.get("translationId") ?? "en-kjv";
    const bookCode = url.searchParams.get("bookCode") ?? "JHN";
    const chapterStr = url.searchParams.get("chapter") ?? "1";
    const versesParam = url.searchParams.get("verses"); // e.g. "16" or "1-5"

    const chapter = Number(chapterStr);
    if (Number.isNaN(chapter) || chapter <= 0) {
      return Response.json(
        { error: "Invalid chapter number" },
        { status: 400 }
      );
    }

    const source = getBibleSource(translationId);
    if (!source) {
      return Response.json(
        { error: `Unknown translation: ${translationId}` },
        { status: 400 }
      );
    }

    // Handle future SQLite sources
    if (source.type === "local-sqlite") {
      return Response.json(
        { error: "Local SQLite sources not yet implemented" },
        { status: 501 }
      );
    }

    // Handle remote-json sources
    if (source.type !== "remote-json" || !source.remoteBaseUrl) {
      return Response.json(
        { error: "Unsupported translation type" },
        { status: 400 }
      );
    }

    const slug = source.bookSlugMap?.[bookCode];
    if (!slug) {
      return Response.json(
        { error: `Unsupported book code: ${bookCode}` },
        { status: 400 }
      );
    }

    // Fetch the chapter from the remote API
    const chapterUrl = `${source.remoteBaseUrl}/books/${slug}/chapters/${chapter}.json`;
    console.log(`Fetching: ${chapterUrl}`);

    const res = await fetch(chapterUrl);
    if (!res.ok) {
      console.error(`Failed to fetch chapter: ${res.status} ${res.statusText}`);
      return Response.json(
        { 
          error: `Failed to fetch chapter from source`,
          details: `${res.status} ${res.statusText}`
        },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Normalize the response
    // The wldeh/bible-api format: { verses: [{ verseId, verse, text }] }
    const allVerses = Array.isArray(data.verses)
      ? data.verses.map((v) => ({
          verse: Number(v.verse) || 0,
          text: String(v.text ?? "").trim(),
        }))
      : [];

    // Filter verses if specific verses requested
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

    const response = {
      reference,
      translationId,
      translationLabel: source.label,
      verses: filtered,
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (err) {
    console.error("bible-passage error:", err);
    return Response.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
});