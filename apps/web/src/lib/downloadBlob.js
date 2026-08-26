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

async function blobBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Persist an export on the active platform. Native WebViews cannot reliably
 * consume synthetic anchor downloads, so Capacitor writes a temporary native
 * file and opens the Android/iOS share sheet. The share sheet lets the user
 * save it to Files or open it in another installed app.
 */
export async function saveExportFile(blob, filename, {
  native = Boolean(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()),
  filesystem,
  share,
  directory,
  browserDownload = downloadBlob,
} = {}) {
  if (!(blob instanceof Blob)) throw new TypeError('A Blob is required');
  if (typeof filename !== 'string' || !filename.trim()) throw new TypeError('A download filename is required');

  if (!native) {
    browserDownload(blob, filename);
    return { filename, method: 'browser-download' };
  }

  let files = filesystem;
  let sharing = share;
  let targetDirectory = directory;
  if (!files || !sharing || !targetDirectory) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    files ||= Filesystem;
    sharing ||= Share;
    targetDirectory ||= Directory.Cache;
  }

  const path = `exports/${filename}`;
  await files.writeFile({
    path,
    data: await blobBase64(blob),
    directory: targetDirectory,
    recursive: true,
  });
  const { uri } = await files.getUri({ path, directory: targetDirectory });
  await sharing.share({
    title: filename,
    files: [uri],
    dialogTitle: `Save or open ${filename}`,
  });
  return { filename, method: 'native-file-share', uri };
}
