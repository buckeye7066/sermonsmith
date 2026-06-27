import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExternalLink, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function EmbeddedBrowserDetector() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [browserName, setBrowserName] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    detectEmbeddedBrowser();
  }, []);

  const detectEmbeddedBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    
    // Detect various embedded browsers - comprehensive list
    const embeddedBrowsers = {
      'Instagram': /Instagram/i.test(ua),
      'Facebook': /FBAN|FBAV|FB_IAB/i.test(ua),
      'Messenger': /Messenger|FBIOS/i.test(ua),
      'TikTok': /TikTok|musical_ly/i.test(ua),
      'LinkedIn': /LinkedInApp/i.test(ua),
      'Twitter': /Twitter/i.test(ua),
      'Snapchat': /Snapchat/i.test(ua),
      'Pinterest': /Pinterest/i.test(ua),
      'WhatsApp': /WhatsApp/i.test(ua),
      'Line': /Line/i.test(ua),
      'WeChat': /MicroMessenger/i.test(ua),
      'Telegram': /TelegramBot/i.test(ua),
      'Discord': /Discord/i.test(ua),
      'Slack': /Slack/i.test(ua),
      'Reddit': /Reddit/i.test(ua),
      'Android WebView': /wv\)|WebView/i.test(ua) && /Android/i.test(ua),
      'iOS WebView': /AppleWebKit(?!.*Safari)|FBAN|FBAV|Instagram/i.test(ua) && /iPhone|iPad|iPod/i.test(ua)
    };

    // Check if in any embedded browser
    for (const [name, isDetected] of Object.entries(embeddedBrowsers)) {
      if (isDetected) {
        setIsEmbedded(true);
        setBrowserName(name);
        setShowPrompt(true);
        return;
      }
    }

    // Additional check: if not standalone and has limited features
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    
    if (!isStandalone && /iPhone|iPad|iPod|Android/i.test(ua)) {
      // Check if it's a known browser
      const isKnownBrowser = /Safari|Chrome|Firefox|Edge|Samsung/i.test(ua) 
        && !/Instagram|FBAN|TikTok|LinkedIn|Twitter/i.test(ua);
      
      if (!isKnownBrowser) {
        setIsEmbedded(true);
        setBrowserName('in-app browser');
        setShowPrompt(true);
      }
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const getInstructions = () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isIOS) {
      return {
        icon: '🍎',
        steps: [
          `Tap the share button (⋯ or ⎙) in ${browserName}`,
          'Select "Open in Safari"',
          'Or copy the URL and paste it in Safari'
        ],
        preferredBrowser: 'Safari'
      };
    } else if (isAndroid) {
      return {
        icon: '🤖',
        steps: [
          `Tap the menu button (⋮) in ${browserName}`,
          'Select "Open in Chrome" or "Open in Browser"',
          'Or copy the URL and paste it in Chrome'
        ],
        preferredBrowser: 'Chrome'
      };
    }

    return {
      icon: '🌐',
      steps: [
        'Copy the URL below',
        'Open your preferred browser (Chrome, Safari, Firefox)',
        'Paste the URL in the address bar'
      ],
      preferredBrowser: 'Chrome or Safari'
    };
  };

  if (!isEmbedded || !showPrompt) {
    return null;
  }

  const instructions = getInstructions();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl border-orange-500/50">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Open in {instructions.preferredBrowser}</CardTitle>
              <CardDescription>For the best experience</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">You're browsing from {browserName}.</span> 
              {' '}For full access to SermonSmith features, please open this app in {instructions.preferredBrowser}.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <span className="text-2xl">{instructions.icon}</span>
              How to open in {instructions.preferredBrowser}:
            </h3>
            <ol className="space-y-2 ml-2">
              {instructions.steps.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm text-gray-600">
                  <span className="font-semibold text-indigo-600">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase">App URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={window.location.href}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
              />
              <Button
                onClick={copyUrl}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                // Try to open in default browser
                const url = window.location.href;
                // For Android, try intent
                if (/Android/i.test(navigator.userAgent)) {
                  window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
                } else {
                  copyUrl();
                }
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Browser
            </Button>
            <Button
              onClick={() => setShowPrompt(false)}
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
            >
              Continue Anyway
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            SermonSmith works best in Safari, Chrome, Firefox, or Edge
          </p>
        </CardContent>
      </Card>
    </div>
  );
}