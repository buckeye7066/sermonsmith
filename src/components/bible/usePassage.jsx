/**
 * React hook for fetching Bible passages
 */

import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * @typedef {Object} UsePassageOptions
 * @property {string} translationId - Translation ID (e.g., "en-kjv")
 * @property {string} bookCode - OSIS book code (e.g., "JHN")
 * @property {number} chapter - Chapter number
 * @property {string} [verses] - Optional verse range (e.g., "16" or "1-5")
 */

/**
 * @typedef {Object} PassageVerse
 * @property {number} verse - Verse number
 * @property {string} text - Verse text
 */

/**
 * @typedef {Object} UsePassageResult
 * @property {boolean} loading - Loading state
 * @property {string | null} error - Error message if any
 * @property {string | null} reference - Formatted reference (e.g., "JHN 3:16")
 * @property {string | null} translationLabel - Translation display name
 * @property {PassageVerse[]} verses - Array of verses
 * @property {Function} retry - Function to retry the fetch
 */

/**
 * Hook to fetch a Bible passage
 * @param {UsePassageOptions} options
 * @returns {UsePassageResult}
 */
export function usePassage(options) {
  const { translationId, bookCode, chapter, verses } = options;
  
  const [state, setState] = useState({
    loading: true,
    error: null,
    reference: null,
    translationLabel: null,
    verses: [],
  });

  const fetchPassage = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams({
        translationId: translationId || "en-kjv",
        bookCode: bookCode || "JHN",
        chapter: String(chapter || 1),
      });
      
      if (verses) {
        params.set("verses", verses);
      }

      const response = await base44.functions.invoke("biblePassage", {
        translationId: translationId || "en-kjv",
        bookCode: bookCode || "JHN",
        chapter: chapter || 1,
        verses: verses || null,
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setState({
        loading: false,
        error: null,
        reference: response.data.reference || null,
        translationLabel: response.data.translationLabel || null,
        verses: response.data.verses || [],
      });
    } catch (err) {
      console.error("Error fetching passage:", err);
      setState((s) => ({
        ...s,
        loading: false,
        error: err?.message || "Failed to load passage",
      }));
    }
  };

  useEffect(() => {
    if (translationId && bookCode && chapter) {
      fetchPassage();
    }
  }, [translationId, bookCode, chapter, verses]);

  return {
    ...state,
    retry: fetchPassage,
  };
}

/**
 * Hook to fetch a random verse (for Verse of the Day)
 * @param {string} translationId
 * @returns {UsePassageResult}
 */
export function useRandomVerse(translationId = "en-kjv") {
  // Popular verses for "Verse of the Day" rotation
  const popularVerses = [
    { bookCode: "JHN", chapter: 3, verses: "16" },
    { bookCode: "PSA", chapter: 23, verses: "1" },
    { bookCode: "PRO", chapter: 3, verses: "5-6" },
    { bookCode: "ROM", chapter: 8, verses: "28" },
    { bookCode: "PHP", chapter: 4, verses: "13" },
    { bookCode: "JER", chapter: 29, verses: "11" },
    { bookCode: "MAT", chapter: 28, verses: "20" },
    { bookCode: "ISA", chapter: 40, verses: "31" },
    { bookCode: "PSA", chapter: 46, verses: "1" },
    { bookCode: "1CO", chapter: 13, verses: "4-7" },
  ];

  // Use date as seed for consistent daily verse
  const today = new Date().toDateString();
  const seed = today.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = seed % popularVerses.length;
  const selectedVerse = popularVerses[index];

  return usePassage({
    translationId,
    ...selectedVerse,
  });
}