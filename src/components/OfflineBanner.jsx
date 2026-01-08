import { useOfflineStatus } from '@/lib/offlineDetector';
import { WifiOff, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const { isOffline } = useOfflineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShow(true);
      setDismissed(false);
    } else {
      // Auto-dismiss when back online
      setShow(false);
      setDismissed(false);
    }
  }, [isOffline]);

  if (!show || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg animate-in slide-in-from-top">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WifiOff className="h-5 w-5" />
          <div>
            <p className="font-semibold">You're offline</p>
            <p className="text-sm text-yellow-800">
              Viewing cached content. Some features are unavailable.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-yellow-600 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
