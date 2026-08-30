import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Download, Smartphone, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone ||
                      document.referrer.includes('android-app://');
    
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // More reliable check to ensure PWA state
    if (ios) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        console.log('Install prompt has been prevented on iOS.');
      });
    }

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e) => {
      try {
        e.preventDefault();
        setDeferredPrompt(e);

        // Show prompt after 10 seconds if not dismissed before
        setTimeout(() => {
          const dismissed = localStorage.getItem('pwa-prompt-dismissed');
          const installCount = localStorage.getItem('pwa-install-count') || 0;
          
          if (!dismissed && installCount < 3 && !standalone) {
            setShowPrompt(true);
          }
        }, 10000);
      } catch (error) {
        console.error('Error handling beforeinstallprompt event:', error);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt after delay
    if (ios && !standalone) {
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-prompt-dismissed-ios');
        const installCount = localStorage.getItem('pwa-install-count-ios') || 0;
        
        if (!dismissed && installCount < 3) {
          setShowPrompt(true);
        }
      }, 15000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
      const count = parseInt(localStorage.getItem('pwa-install-count') || 0);
      localStorage.setItem('pwa-install-count', count + 1);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('pwa-prompt-dismissed-ios', 'true');
    } else {
      localStorage.setItem('pwa-prompt-dismissed', 'true');
    }
    
    // Re-enable after 7 days
    setTimeout(() => {
      if (isIOS) {
        localStorage.removeItem('pwa-prompt-dismissed-ios');
      } else {
        localStorage.removeItem('pwa-prompt-dismissed');
      }
    }, 7 * 24 * 60 * 60 * 1000);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
        >
          <Card className="shadow-2xl border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40">
            <CardContent className="pt-6 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-600 rounded-full">
                  {isIOS ? (
                    <Smartphone className="w-6 h-6 text-white" />
                  ) : (
                    <Download className="w-6 h-6 text-white" />
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">
                    Install SermonSmith
                  </h3>
                  
                  {isIOS ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                      <p>Install SermonSmith on your iPhone for the best experience:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Tap the Share button <span className="text-blue-600">⬆️</span></li>
                        <li>Scroll down and tap "Add to Home Screen"</li>
                        <li>Tap "Add" to install</li>
                      </ol>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        Install SermonSmith as an app for faster access, offline support, and a better experience!
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleInstall}
                          className="bg-indigo-600 hover:bg-indigo-700"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Install App
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDismiss}
                        >
                          Maybe Later
                        </Button>
                      </div>
                    </>
                  )}

                  {!isIOS && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
                      <Monitor className="w-3 h-3" />
                      <span>Works on desktop and mobile</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}