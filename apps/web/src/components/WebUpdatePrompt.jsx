import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BAKED_BUNDLE_VERSION } from '@/lib/mobileUpdater';
import { fetchBrowserBuild, verifyBrowserBuildReady } from '@/lib/browserUpdater';
import { isNativeApp } from '@/lib/platform';

export default function WebUpdatePrompt() {
  const [build, setBuild] = useState(/** @type {any} */ (null));
  const [dismissed, setDismissed] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    if (isNativeApp() || window.electron?.isElectron || !import.meta.env.PROD) return undefined;
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (stopped || checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const manifest = await fetchBrowserBuild();
        // The origin is authoritative, including an intentional rollback.
        if (!stopped) setBuild(manifest.version !== BAKED_BUNDLE_VERSION ? manifest : null);
      } catch {
        // Offline users keep working; a failed check is never "up to date".
      } finally { checking = false; }
    };
    const resume = () => { if (document.visibilityState === 'visible') void check(); };
    const timer = setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    void check();
    return () => {
      active.current = false;
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, []);
  if (!build || build.version === dismissed) return null;
  const update = async () => {
    if (busy) return;
    const pageAtStart = window.location.href;
    setBusy(true);
    setError('');
    try {
      await verifyBrowserBuildReady(build);
      if (!active.current) return;
      setBusy(false);
      if (window.location.href === pageAtStart
          && window.confirm('The update is ready. Save your changes before updating. Reload SermonSmith now?')) window.location.reload();
    } catch {
      if (!active.current) return;
      setError('The update is not fully available yet. Your current page is unchanged; try again shortly.');
      setBusy(false);
    }
  };
  return (
    <aside role="status" className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-800 dark:border-blue-900 dark:bg-blue-950 dark:text-slate-100">
      <p>A new version of SermonSmith is available. Save your changes before updating.</p>
      {error && <p role="alert">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={update} disabled={busy}>{busy ? 'Checking update...' : 'Update'}</Button>
        <Button size="sm" variant="outline" onClick={() => setDismissed(build.version)} disabled={busy}>Later</Button>
      </div>
    </aside>
  );
}
