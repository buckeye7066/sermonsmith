/**
 * Returns a usable Web Speech API synthesis engine, or null when the browser
 * does not expose the complete surface AudioPlayer needs.
 */
export function resolveSpeechSynthesis(
  scope = typeof window === 'undefined' ? undefined : window
) {
  try {
    const synthesis = scope?.speechSynthesis;
    if (
      !synthesis ||
      typeof synthesis.getVoices !== 'function' ||
      typeof synthesis.cancel !== 'function' ||
      typeof synthesis.speak !== 'function'
    ) {
      return null;
    }
    return synthesis;
  } catch {
    return null;
  }
}

/**
 * Some WebViews expose speechSynthesis but throw while their voice service is
 * starting. Treat that as an empty voice list; the voiceschanged event can
 * repopulate it later.
 */
export function readAvailableVoices(synthesis) {
  if (!synthesis || typeof synthesis.getVoices !== 'function') {
    return [];
  }

  try {
    const voices = synthesis.getVoices();
    return Array.isArray(voices) ? voices : [];
  } catch {
    return [];
  }
}
