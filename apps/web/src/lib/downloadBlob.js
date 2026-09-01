/**
 * Start a browser download without invalidating its object URL before WebKit
 * has consumed the click. Safari can cancel downloads when the URL is revoked
 * synchronously, even though Chromium usually completes them.
 */
export function downloadBlob(blob, filename, {
  documentObject = document,
  urlApi = URL,
  schedule = setTimeout,
} = {}) {
  if (!(blob instanceof Blob)) throw new TypeError('A Blob is required');
  if (typeof filename !== 'string' || filename.trim() === '') {
    throw new TypeError('A download filename is required');
  }

  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentObject.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;

  try {
    documentObject.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // One event-loop turn is not consistently enough for iOS Safari. A short,
    // bounded grace period keeps the URL alive without leaking it long-term.
    schedule(() => urlApi.revokeObjectURL(objectUrl), 1_000);
  }

  return objectUrl;
}
