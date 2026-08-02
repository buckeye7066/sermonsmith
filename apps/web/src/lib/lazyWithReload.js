import { lazy } from 'react';

// Recovery for the "stale deploy" chunk failure.
//
// Every page is a lazily imported chunk with a content hash in its filename.
// Each production deploy replaces the asset set, and Vercel serves ONLY the
// current deployment's hashed assets. A tab (or installed PWA) that loaded the
// app before a deploy still holds the OLD index/entry in memory, so the first
// click on a not-yet-visited page (for most users: "Bible Reader") requests an
// asset hash that no longer exists -> 404 -> "Failed to fetch dynamically
// imported module" -> the ErrorBoundary's "Something went wrong" screen.
// Reproduced deterministically on 2026-08-02 with a two-build swap harness.
//
// The fix: when a lazy import fails with a chunk-load error, force ONE full
// reload. The reload fetches the current index.html (the service worker is
// network-first for navigations), which references the live asset hashes, and
// the router restores the same URL — so the user lands on the page they
// clicked, on the new deploy. A sessionStorage timestamp guards against a
// reload loop when the chunk is genuinely unreachable (offline, real outage):
// a second failure within the guard window falls through to the ErrorBoundary.

const RELOAD_GUARD_KEY = 'ss:chunk-reload-at';
const RELOAD_GUARD_WINDOW_MS = 60_000;

function readGuard() {
  try {
    return Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
  } catch {
    // Storage unavailable (rare privacy modes): behave as "recently reloaded"
    // so we never risk an unguarded reload loop.
    return Date.now();
  }
}

function writeGuard() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function clearGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // ignore
  }
}

export function isChunkLoadError(error) {
  const message = String((error && error.message) || error || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message
  );
}

// Exported separately from the React wrapper so the recovery logic is unit
// testable without rendering a Suspense tree.
export async function loadWithReload(importer, { reload = () => window.location.reload() } = {}) {
  try {
    const mod = await importer();
    clearGuard();
    return mod;
  } catch (error) {
    const recentlyReloaded = Date.now() - readGuard() < RELOAD_GUARD_WINDOW_MS;
    if (isChunkLoadError(error) && !recentlyReloaded && writeGuard()) {
      reload();
      // Keep the Suspense fallback (spinner) on screen while the browser
      // tears the page down for the reload.
      return new Promise(() => {});
    }
    throw error;
  }
}

export function lazyWithReload(importer) {
  return lazy(() => loadWithReload(importer));
}
