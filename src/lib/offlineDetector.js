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
        const response = await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          cache: 'no-store'
        });
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    };

    // Check every 30 seconds
    const intervalId = setInterval(checkConnection, 30000);

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
