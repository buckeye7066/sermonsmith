import { useState, useEffect } from "react";
import { api } from '@/api/apiClient';

/**
 * React hook to fetch Bible passages on-demand
 * 
 * @param {Object} options - Fetch options
 * @param {string} options.translationId - Bible translation ID
 * @param {string} options.bookCode - OSIS book code (e.g., "JHN", "GEN")
 * @param {number} options.chapter - Chapter number
 * @param {string} [options.verses] - Optional verse range (e.g., "1-5")
 * @returns {Object} - { loading, error, reference, translationLabel, verses }
 */
export function usePassage({ translationId, bookCode, chapter, verses }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    reference: null,
    translationLabel: null,
    verses: [],
  });

  useEffect(() => {
    let cancelled = false;

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

        const response = await api.functions.invoke("biblePassage", {
          translationId: translationId || "en-kjv",
          bookCode: bookCode || "JHN",
          chapter: String(chapter || 1),
          verses: verses || null,
        });

        if (cancelled) return;

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
        if (cancelled) return;
        
        console.error("Error fetching passage:", err);
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || "Failed to load passage",
        }));
      }
    };

    fetchPassage();

    return () => {
      cancelled = true;
    };
  }, [translationId, bookCode, chapter, verses]);

  return state;
}

/**
 * Fetch a single passage without a hook (for one-time use)
 * 
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Passage data
 */
export async function fetchPassage({ translationId, bookCode, chapter, verses }) {
  try {
    const response = await api.functions.invoke("biblePassage", {
      translationId: translationId || "en-kjv",
      bookCode: bookCode || "JHN",
      chapter: String(chapter || 1),
      verses: verses || null,
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  } catch (err) {
    console.error("Error fetching passage:", err);
    throw err;
  }
}