/**
 * Bible Source Abstraction Layer
 * Defines available Bible translations and how to fetch them
 */

/**
 * @typedef {'remote-json' | 'local-sqlite'} BibleSourceType
 */

/**
 * @typedef {Object} BibleSource
 * @property {string} id - Unique identifier (e.g., "en-kjv")
 * @property {string} label - Display name (e.g., "King James Version (KJV)")
 * @property {BibleSourceType} type - Source type
 * @property {string} [remoteBaseUrl] - Base URL for remote-json sources
 * @property {Record<string, string>} [bookSlugMap] - OSIS code to API slug mapping
 * @property {boolean} [default] - Whether this is the default translation
 * @property {boolean} [premium] - Whether this requires premium access
 */

/**
 * Available Bible translations
 * @type {BibleSource[]}
 */
export const bibleSources = [
  {
    id: "en-kjv",
    label: "King James Version (KJV)",
    type: "remote-json",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-kjv",
    bookSlugMap: {
      GEN: "genesis",
      EXO: "exodus",
      LEV: "leviticus",
      NUM: "numbers",
      DEU: "deuteronomy",
      JOS: "joshua",
      JDG: "judges",
      RUT: "ruth",
      "1SA": "1-samuel",
      "2SA": "2-samuel",
      "1KI": "1-kings",
      "2KI": "2-kings",
      "1CH": "1-chronicles",
      "2CH": "2-chronicles",
      EZR: "ezra",
      NEH: "nehemiah",
      EST: "esther",
      JOB: "job",
      PSA: "psalms",
      PRO: "proverbs",
      ECC: "ecclesiastes",
      SNG: "song-of-solomon",
      ISA: "isaiah",
      JER: "jeremiah",
      LAM: "lamentations",
      EZK: "ezekiel",
      DAN: "daniel",
      HOS: "hosea",
      JOL: "joel",
      AMO: "amos",
      OBA: "obadiah",
      JON: "jonah",
      MIC: "micah",
      NAM: "nahum",
      HAB: "habakkuk",
      ZEP: "zephaniah",
      HAG: "haggai",
      ZEC: "zechariah",
      MAL: "malachi",
      MAT: "matthew",
      MRK: "mark",
      LUK: "luke",
      JHN: "john",
      ACT: "acts",
      ROM: "romans",
      "1CO": "1-corinthians",
      "2CO": "2-corinthians",
      GAL: "galatians",
      EPH: "ephesians",
      PHP: "philippians",
      COL: "colossians",
      "1TH": "1-thessalonians",
      "2TH": "2-thessalonians",
      "1TI": "1-timothy",
      "2TI": "2-timothy",
      TIT: "titus",
      PHM: "philemon",
      HEB: "hebrews",
      JAS: "james",
      "1PE": "1-peter",
      "2PE": "2-peter",
      "1JN": "1-john",
      "2JN": "2-john",
      "3JN": "3-john",
      JUD: "jude",
      REV: "revelation",
    },
    default: true,
    premium: false,
  },
  {
    id: "en-web",
    label: "World English Bible (WEB)",
    type: "remote-json",
    remoteBaseUrl: "https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-web",
    bookSlugMap: {
      GEN: "genesis",
      EXO: "exodus",
      LEV: "leviticus",
      NUM: "numbers",
      DEU: "deuteronomy",
      JOS: "joshua",
      JDG: "judges",
      RUT: "ruth",
      "1SA": "1-samuel",
      "2SA": "2-samuel",
      "1KI": "1-kings",
      "2KI": "2-kings",
      "1CH": "1-chronicles",
      "2CH": "2-chronicles",
      EZR: "ezra",
      NEH: "nehemiah",
      EST: "esther",
      JOB: "job",
      PSA: "psalms",
      PRO: "proverbs",
      ECC: "ecclesiastes",
      SNG: "song-of-solomon",
      ISA: "isaiah",
      JER: "jeremiah",
      LAM: "lamentations",
      EZK: "ezekiel",
      DAN: "daniel",
      HOS: "hosea",
      JOL: "joel",
      AMO: "amos",
      OBA: "obadiah",
      JON: "jonah",
      MIC: "micah",
      NAM: "nahum",
      HAB: "habakkuk",
      ZEP: "zephaniah",
      HAG: "haggai",
      ZEC: "zechariah",
      MAL: "malachi",
      MAT: "matthew",
      MRK: "mark",
      LUK: "luke",
      JHN: "john",
      ACT: "acts",
      ROM: "romans",
      "1CO": "1-corinthians",
      "2CO": "2-corinthians",
      GAL: "galatians",
      EPH: "ephesians",
      PHP: "philippians",
      COL: "colossians",
      "1TH": "1-thessalonians",
      "2TH": "2-thessalonians",
      "1TI": "1-timothy",
      "2TI": "2-timothy",
      TIT: "titus",
      PHM: "philemon",
      HEB: "hebrews",
      JAS: "james",
      "1PE": "1-peter",
      "2PE": "2-peter",
      "1JN": "1-john",
      "2JN": "2-john",
      "3JN": "3-john",
      JUD: "jude",
      REV: "revelation",
    },
    premium: false,
  },
  // Future: SQLite-based offline sources
  // {
  //   id: "en-web-sqlite",
  //   label: "World English Bible (offline)",
  //   type: "local-sqlite",
  //   premium: false,
  // }
];

/**
 * Book name to OSIS code mapping
 */
export const BOOK_NAME_TO_OSIS = {
  "Genesis": "GEN",
  "Exodus": "EXO",
  "Leviticus": "LEV",
  "Numbers": "NUM",
  "Deuteronomy": "DEU",
  "Joshua": "JOS",
  "Judges": "JDG",
  "Ruth": "RUT",
  "1 Samuel": "1SA",
  "2 Samuel": "2SA",
  "1 Kings": "1KI",
  "2 Kings": "2KI",
  "1 Chronicles": "1CH",
  "2 Chronicles": "2CH",
  "Ezra": "EZR",
  "Nehemiah": "NEH",
  "Esther": "EST",
  "Job": "JOB",
  "Psalms": "PSA",
  "Proverbs": "PRO",
  "Ecclesiastes": "ECC",
  "Song of Solomon": "SNG",
  "Isaiah": "ISA",
  "Jeremiah": "JER",
  "Lamentations": "LAM",
  "Ezekiel": "EZK",
  "Daniel": "DAN",
  "Hosea": "HOS",
  "Joel": "JOL",
  "Amos": "AMO",
  "Obadiah": "OBA",
  "Jonah": "JON",
  "Micah": "MIC",
  "Nahum": "NAM",
  "Habakkuk": "HAB",
  "Zephaniah": "ZEP",
  "Haggai": "HAG",
  "Zechariah": "ZEC",
  "Malachi": "MAL",
  "Matthew": "MAT",
  "Mark": "MRK",
  "Luke": "LUK",
  "John": "JHN",
  "Acts": "ACT",
  "Romans": "ROM",
  "1 Corinthians": "1CO",
  "2 Corinthians": "2CO",
  "Galatians": "GAL",
  "Ephesians": "EPH",
  "Philippians": "PHP",
  "Colossians": "COL",
  "1 Thessalonians": "1TH",
  "2 Thessalonians": "2TH",
  "1 Timothy": "1TI",
  "2 Timothy": "2TI",
  "Titus": "TIT",
  "Philemon": "PHM",
  "Hebrews": "HEB",
  "James": "JAS",
  "1 Peter": "1PE",
  "2 Peter": "2PE",
  "1 John": "1JN",
  "2 John": "2JN",
  "3 John": "3JN",
  "Jude": "JUD",
  "Revelation": "REV",
};

/**
 * Get a Bible source by ID
 * @param {string} id - Source ID
 * @returns {BibleSource | undefined}
 */
export function getBibleSource(id) {
  return bibleSources.find((s) => s.id === id);
}

/**
 * Get the default Bible source
 * @returns {BibleSource}
 */
export function getDefaultBibleSource() {
  return bibleSources.find((s) => s.default) || (bibleSources.length > 0 ? bibleSources[0] : undefined);
}

/**
 * Get all available Bible sources
 * @returns {BibleSource[]}
 */
export function getAllBibleSources() {
  return bibleSources;
}