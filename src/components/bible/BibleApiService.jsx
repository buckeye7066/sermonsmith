/**
 * Bible API Service
 * Wrapper around the biblePassage function for non-React code
 */

import { base44 } from "@/api/base44Client";
import { bookNameToOsis } from "./bibleSources";

/**
 * Fetch a Bible passage
 * @param {Object} options
 * @param {string} options.translationId - Translation ID
 * @param {string} options.bookCode - OSIS book code or book name
 * @param {number} options.chapter - Chapter number
 * @param {string} [options.verses] - Optional verse range
 * @returns {Promise<Object>}
 */
export async function fetchPassage(options) {
  const { translationId, bookCode, chapter, verses } = options;
  
  // Convert book name to OSIS code if needed
  let osisCode = bookCode;
  if (bookCode && bookCode.length > 3) {
    osisCode = bookNameToOsis(bookCode) || bookCode;
  }

  try {
    const response = await base44.functions.invoke("biblePassage", {
      translationId: translationId || "en-kjv",
      bookCode: osisCode,
      chapter: chapter || 1,
      verses: verses || null,
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (error) {
    console.error("Error fetching passage:", error);
    throw error;
  }
}

/**
 * Fetch multiple verses for search/cross-reference
 * @param {Object} options
 * @param {string} options.translationId
 * @param {Array<{bookCode: string, chapter: number, verses: string}>} options.passages
 * @returns {Promise<Array>}
 */
export async function fetchMultiplePassages(options) {
  const { translationId, passages } = options;
  
  const promises = passages.map(p => 
    fetchPassage({
      translationId,
      bookCode: p.bookCode,
      chapter: p.chapter,
      verses: p.verses,
    }).catch(err => {
      console.error(`Failed to fetch ${p.bookCode} ${p.chapter}:${p.verses}`, err);
      return null;
    })
  );

  const results = await Promise.all(promises);
  return results.filter(r => r !== null);
}

/**
 * Search for verses containing a query
 * Note: This is a simple implementation that searches popular passages
 * A full-text search would require a dedicated search API
 * @param {Object} options
 * @param {string} options.translationId
 * @param {string} options.query
 * @returns {Promise<Array>}
 */
export async function searchVerses(options) {
  const { translationId, query } = options;
  
  // For now, return an empty array
  // In the future, this could use a dedicated search API
  // or implement client-side search across cached chapters
  console.warn("Full Bible search not yet implemented. Use specific passage lookup instead.");
  return [];
}