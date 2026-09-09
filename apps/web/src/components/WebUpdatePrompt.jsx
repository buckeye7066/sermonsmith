import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BAKED_BUNDLE_VERSION, fetchUpdateManifest, isNewerVersion } from '@/lib/mobileUpdater';
import { isNativeApp } from '@/lib/platform';

export default function WebUpdatePrompt() {
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState('');
  useEffect(() => {
    if (isNativeApp() || window.electron?.isElectron || !import.meta.env.PROD) return undefined;
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (stopped || checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const manifest = await fetchUpdateManifest();
        if (!stopped && isNewerVersion(manifest.version, BAKED_BUNDLE_VERSION)) setVersion(manifest.version);
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
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, []);
  if (!version || version === dismissed) return null;
  const update = () => {
    if (window.confirm('Save your changes before updating. Reload SermonSmith now?')) window.location.reload();
  };
  return (
    <aside role="status" className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-800 dark:border-blue-900 dark:bg-blue-950 dark:text-slate-100">
      <p>A new version of SermonSmith is available. Save your changes before updating.</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={update}>Update</Button>
        <Button size="sm" variant="outline" onClick={() => setDismissed(version)}>Later</Button>
      </div>
    </aside>
  );
}
