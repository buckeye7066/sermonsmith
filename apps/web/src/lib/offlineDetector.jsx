import { createContext, useContext, useState, useEffect } from 'react';

const OfflineContext = createContext({
  isOnline: true,
  isOffline: false
});

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    // Update online status based on browser events
    const handleOnline = () => {
      console.log('Network: Online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check to verify connectivity
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        // Try to fetch a small resource to verify connectivity
        // Using a HEAD request to the app's own domain when available
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch('/icon.png', {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch (error) {
        // If local check fails, assume offline
        setIsOnline(false);
      }
    };

    // Check every 60 seconds (battery-friendly interval)
    const intervalId = setInterval(checkConnection, 60000);

    // Initial check
    checkConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, isOffline: !isOnline }}>
      {children}
    </OfflineContext.Provider>
  );
}

/**
 * Hook to access offline status
 * @returns {{isOnline: boolean, isOffline: boolean}}
 */
export function useOfflineStatus() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOfflineStatus must be used within an OfflineProvider');
  }
  return context;
}

/**
 * Check if currently online
 */
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Check if currently offline
 */
export function isOffline() {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false;
}
