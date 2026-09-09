import { apiFetch } from '@/api/apiClient';

const publicFetch = (url, options) => apiFetch('', { ...options, absoluteUrl: url, rawResponse: true, retry: false });

// Static deployment metadata is separate from authenticated application APIs.
const TIMEOUT_MS = 12000;

export function parseBrowserBuild(raw) {
  if (!raw || typeof raw.version !== 'string' || !/^\d+(\.\d+){3}$/.test(raw.version)
      || !Array.isArray(raw.assets) || raw.assets.length === 0 || raw.assets.length > 1000) {
    throw new Error('This deployment has not published a complete update manifest.');
  }
  const assets = raw.assets.map((asset) => {
    if (!asset || typeof asset.path !== 'string'
        || !/^(app\.html|assets\/[A-Za-z0-9_./-]+\.(js|css))$/.test(asset.path)
        || asset.path.includes('..') || !/^[a-f0-9]{64}$/.test(asset.sha256 || '')) {
      throw new Error('The update manifest contains an invalid asset.');
    }
    return { path: asset.path, sha256: asset.sha256 };
  });
  if (!assets.some((asset) => asset.path === 'app.html') || !assets.some((asset) => asset.path.endsWith('.js'))) {
    throw new Error('The update manifest is missing its application entrypoint.');
  }
  return { version: raw.version, assets };
}

async function readResponse(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`Update resource unavailable (HTTP ${response.status}).`);
    // Keep the timeout active through body transfer, not only until headers.
    return await response.arrayBuffer();
  } finally { clearTimeout(timer); }
}

export async function fetchBrowserBuild({ fetchImpl = publicFetch, baseUrl = window.location.origin } = {}) {
  const url = new URL('/build-info.json', baseUrl);
  url.searchParams.set('_update', `${Date.now()}-${Math.random()}`);
  return parseBrowserBuild(JSON.parse(new TextDecoder().decode(await readResponse(url.href, fetchImpl))));
}

export async function verifyBrowserBuildReady(manifest, {
  fetchImpl = publicFetch,
  baseUrl = window.location.origin,
  cryptoImpl = window.crypto,
} = {}) {
  const build = parseBrowserBuild(manifest);
  let next = 0;
  // A reachable HTML page is insufficient: every generated JS/CSS chunk must
  // have the exact deployed bytes before an editing session can be reloaded.
  const worker = async () => {
    while (next < build.assets.length) {
      const asset = build.assets[next++];
      const url = new URL('/' + asset.path, baseUrl);
      url.searchParams.set('_update', build.version);
      const bytes = await readResponse(url.href, fetchImpl);
      const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== asset.sha256) throw new Error('The new version is not fully available yet. Try Update again shortly.');
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, build.assets.length) }, worker));
  const latest = await fetchBrowserBuild({ fetchImpl, baseUrl });
  if (JSON.stringify(latest) !== JSON.stringify(build)) throw new Error('The deployment changed during the check. Try Update again.');
}
