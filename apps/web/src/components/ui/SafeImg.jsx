import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';

// Local replacement for any image that used to live on the now-dead
// Base44 storage host (it currently returns 503). Anything matching one
// of these substrings is swapped to the local /icon.svg *before* the
// browser is even asked to fetch it, so DevTools stays quiet.
const LEGACY_HOSTS = [
  'base44-prod',
  'storage/v1/object/public/base44',
];
const DEFAULT_FALLBACK = '/icon.svg';

function isLegacyHost(url) {
  if (!url || typeof url !== 'string') return false;
  return LEGACY_HOSTS.some((needle) => url.includes(needle));
}

/**
 * Image element with a multi-stage fallback chain.
 *
 *   primary src
 *     → `fallback` prop (if provided)
 *     → local `/icon.svg`
 *     → in-DOM `<BookOpen />` icon (when `useFallbackIcon` is set)
 *
 * Legacy Base44 storage URLs are short-circuited up front because the
 * host has been retired and now answers 503 for every asset; pretending
 * to fetch them just pollutes the console.
 */
export function SafeImg({
  fallback = DEFAULT_FALLBACK,
  onError,
  alt = 'image',
  useFallbackIcon = false,
  ...props
}) {
  const initial = isLegacyHost(props.src) ? fallback : props.src;
  const [src, setSrc] = useState(initial);
  const [hasError, setHasError] = useState(false);

  // Keep the displayed image in sync if the parent swaps the URL.
  useEffect(() => {
    setHasError(false);
    setSrc(isLegacyHost(props.src) ? fallback : props.src);
  }, [props.src, fallback]);

  const handleError = (e) => {
    if (fallback && src !== fallback) {
      setSrc(fallback);
    } else if (src !== DEFAULT_FALLBACK) {
      // One more rung — try the canonical app icon before giving up.
      setSrc(DEFAULT_FALLBACK);
    } else {
      setHasError(true);
    }
    onError?.(e);
  };

  if (hasError && useFallbackIcon) {
    return (
      <div
        className={props.className}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <BookOpen className="w-full h-full text-blue-600" />
      </div>
    );
  }

  return (
    <img
      {...props}
      src={src}
      onError={handleError}
      alt={alt}
    />
  );
}
