import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Book, FileText, Settings, PlusCircle, MapPin, GraduationCap, Crown, LogOut, Home, Brain, BookOpen, Users, Globe, Scale, Heart, MessageSquare, Shield } from 'lucide-react';
import { SafeImg } from '@/components/ui/SafeImg';
import { toast } from 'sonner';
import { usePremiumAccess } from './components/hooks/usePremiumAccess';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OnboardingWizard from './components/profile/OnboardingWizard';
import EmbeddedBrowserDetector from './components/EmbeddedBrowserDetector';
import WhatsNewDialog, { CURRENT_VERSION } from './components/WhatsNewDialog';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isPremium, devOverride, loading: accessLoading } = usePremiumAccess();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    loadUser();

    // Register service worker only in production (not in preview/dev mode)
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost' && !window.location.hostname.includes('preview')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('SW registered:', registration);
          })
          .catch(err => {
            console.log('SW registration failed:', err);
          });
      });
    }

    // Enhanced PWA Setup with better mobile support
    document.querySelectorAll('link[rel="manifest"]').forEach(link => link.remove());

    const manifest = {
      "name": "SermonSmith - AI Bible Study & Sermon Builder",
      "short_name": "SermonSmith",
      "description": "AI-Powered Bible Study, Sermon Builder, and Scripture Reader",
      "start_url": "/?source=pwa",
      "scope": "/",
      "display": "standalone",
      "orientation": "portrait-primary",
      "background_color": "#ffffff",
      "theme_color": "#4f46e5",
      "categories": ["education", "productivity", "lifestyle"],
      "icons": [
        {
          "src": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png",
          "sizes": "192x192",
          "type": "image/png",
          "purpose": "any maskable"
        },
        {
          "src": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png",
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "any maskable"
        }
      ],
      "shortcuts": [
        {
          "name": "Bible Reader",
          "short_name": "Read Bible",
          "description": "Open Bible Reader",
          "url": "/pages/Reader?source=shortcut",
          "icons": [{ "src": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png", "sizes": "192x192" }]
        },
        {
          "name": "Sermon Builder",
          "short_name": "New Sermon",
          "description": "Create new sermon",
          "url": "/pages/SermonBuilder?source=shortcut",
          "icons": [{ "src": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png", "sizes": "192x192" }]
        },
        {
          "name": "Bible Study",
          "short_name": "Study",
          "description": "Create Bible study",
          "url": "/pages/BibleStudy?source=shortcut",
          "icons": [{ "src": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png", "sizes": "192x192" }]
        }
      ],
      "share_target": {
        "action": "/pages/Reader?share=true",
        "method": "GET",
        "params": {
          "title": "title",
          "text": "text",
          "url": "url"
        }
      },
      "protocol_handlers": [
        {
          "protocol": "web+bible",
          "url": "/pages/Reader?verse=%s"
        }
      ]
    };

    const manifestDataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestDataUri;
    document.head.appendChild(manifestLink);

    // Mobile-optimized meta tags
    const addMetaTag = (name, content) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    addMetaTag('theme-color', '#4f46e5');
    addMetaTag('apple-mobile-web-app-capable', 'yes');
    addMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    addMetaTag('apple-mobile-web-app-title', 'SermonSmith');
    addMetaTag('mobile-web-app-capable', 'yes');
    addMetaTag('format-detection', 'telephone=no');
    addMetaTag('referrer', 'no-referrer-when-downgrade');

    // Add Content Security Policy for embedded browsers
    const addHttpEquivMeta = (httpEquiv, content) => {
      let meta = document.querySelector(`meta[http-equiv="${httpEquiv}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.httpEquiv = httpEquiv;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };
    addHttpEquivMeta('Content-Security-Policy', 'upgrade-insecure-requests');

    // Cross-browser localStorage fix for iOS in-app browsers
    try {
      localStorage.setItem("__storage_test__", "1");
      localStorage.removeItem("__storage_test__");
    } catch (e) {
      console.warn("localStorage disabled — using fallback memory store");
      const memoryStore = {};
      window.localStorage = {
        setItem: (k, v) => { memoryStore[k] = v; },
        getItem: (k) => memoryStore[k] || null,
        removeItem: (k) => { delete memoryStore[k]; },
        clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
        key: (i) => Object.keys(memoryStore)[i] || null,
        get length() { return Object.keys(memoryStore).length; }
      };
    }

    // iOS splash screens and icons
    const addAppleTouchIcon = (sizes) => {
      let link = document.querySelector(`link[rel="apple-touch-icon"][sizes="${sizes}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.sizes = sizes;
        document.head.appendChild(link);
      }
      link.href = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png';
    };

    addAppleTouchIcon('180x180');
    addAppleTouchIcon('152x152');
    addAppleTouchIcon('144x144');
    addAppleTouchIcon('120x120');
    addAppleTouchIcon('76x76');

    // Prevent zoom on input focus (mobile)
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }

    // Handle deep links from URL parameters
    const handleDeepLink = () => {
      const params = new URLSearchParams(window.location.search);
      const verse = params.get('verse');
      const share = params.get('share');

      if (verse) {
        // Parse verse reference like "John 3:16" and navigate
        const match = verse.match(/(.+?)\s+(\d+):(\d+)/);
        if (match) {
          const [, book, chapter, verseNum] = match;
          window.location.href = `/pages/Reader?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verseNum}`;
        }
      }

      if (share) {
        const text = params.get('text');
        const url = params.get('url');
        if (text || url) {
          sessionStorage.setItem('sharedContent', JSON.stringify({ text, url }));
        }
      }
    };

    handleDeepLink();

    }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser && !currentUser.onboarding_completed) {
        setTimeout(() => setShowOnboarding(true), 1000);
      } else if (currentUser) {
        // Check for special message
        if (currentUser.special_message) {
          setTimeout(() => {
            toast.success(currentUser.special_message, {
              duration: 8000,
              className: "text-lg"
            });
            // Clear the message after showing
            base44.auth.updateMe({ special_message: null }).catch(() => {});
          }, 1000);
        }
        
        // Check if user has seen the latest updates
        const lastSeenVersion = currentUser.last_seen_version || "";
        if (lastSeenVersion !== CURRENT_VERSION) {
          setTimeout(() => setShowWhatsNew(true), 1500);
        }
      }
    } catch (error) {
      console.log('User not logged in');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
      toast.success("Logged out successfully");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const handleLogin = async () => {
    try {
      // Handle in-app browser login issues (Facebook, Instagram, Messenger, etc.)
      const ua = navigator.userAgent || "";
      const isInApp = /FBAN|FBAV|Instagram|Messenger|Line|TikTok|Snapchat|WebView|wv\)/i.test(ua);
      
      if (isInApp) {
        // Force direct navigation for in-app browsers to avoid popup blocking
        window.location.href = window.location.origin + '/auth/login';
      } else {
        await base44.auth.redirectToLogin();
      }
    } catch (error) {
      toast.error("Failed to login");
    }
  };

  const menuItems = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'Bible Reader', icon: Book, page: 'Reader' },
    { name: 'Sermon Builder', icon: FileText, page: 'SermonBuilder' },
    { name: 'My Sermons', icon: FileText, page: 'MySermons' },
    { name: 'Sermon Analytics', icon: Scale, page: 'SermonAnalytics' },
    { name: 'Sermon Library', icon: BookOpen, page: 'SermonLibrary' },
    { name: 'Bible Study', icon: GraduationCap, page: 'BibleStudy' },
    { name: 'My Studies', icon: GraduationCap, page: 'MyStudies' },
    { name: 'Study Plans', icon: MapPin, page: 'PlanLibrary' },
    { name: 'Prayer Generator', icon: Heart, page: 'PrayerGenerator' },
    { name: 'Quiz Builder', icon: PlusCircle, page: 'QuizBuilder' },
    { name: 'My Quizzes', icon: Brain, page: 'MyQuizzes' },
    { name: 'Bible Maps', icon: MapPin, page: 'BibleMaps' },
    { name: 'Christian Ethics', icon: Scale, page: 'ChristianEthics' },
    { name: 'Community', icon: Users, page: 'Community', premium: true },
    { name: 'Worldview Explorer', icon: Globe, page: 'WorldviewExplorer', premium: true },
    { name: 'Contact Support', icon: MessageSquare, page: 'ContactSupport' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
    { name: 'Admin Messages', icon: MessageSquare, page: 'AdminMessages', devOnly: true },
    { name: 'Admin Users', icon: Users, page: 'AdminUsers', devOnly: true },
    { name: 'Admin Analytics', icon: Brain, page: 'AdminAnalytics', devOnly: true },
    { name: 'System Self-Check', icon: Shield, page: 'SystemSelfCheck', devOnly: true }
  ];

  if (loading || accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <SafeImg
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png"
            alt="SermonSmith"
            className="mx-auto h-24 w-24 rounded-full shadow-lg"
            useFallbackIcon={true}
          />
          <h1 className="mt-6 text-4xl font-bold text-gray-900">SermonSmith</h1>
          <p className="mt-2 text-lg text-gray-600">AI-Powered Bible Study & Sermon Builder</p>
          <p className="mt-4 text-gray-500 max-w-sm mx-auto">
            Empower your ministry with fast scripture search, verse-by-verse notes, highlights, and AI sermon building.
          </p>
          <Button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-lg"
          >
            Sign In to Get Started
          </Button>
          <p className="mt-8 text-sm text-gray-400">
            Works on iPhone, Android, Mac, Windows, and Web
          </p>
        </div>
        <PWAInstallPrompt />
        <EmbeddedBrowserDetector />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <EmbeddedBrowserDetector />
      <div className="flex h-screen bg-gray-50">
        <Sidebar className="border-r border-gray-200 hidden md:block">
          <SidebarHeader className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <SafeImg
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b8e99cb327a0a00150c183/99dd4ccc2_logo.png"
                alt="SermonSmith"
                className="h-10 w-10 rounded-full"
                useFallbackIcon={true}
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">SermonSmith</h1>
                <p className="text-sm text-gray-500 truncate">{user.full_name || user.email}</p>
                {devOverride && (
                  <p className="text-xs text-yellow-600 font-medium">Developer Access</p>
                )}
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <SidebarMenu>
              {!isPremium && (
                <SidebarMenuItem className="mb-4">
                  <Link to={createPageUrl('Pricing')}>
                    <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-lg">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                  </Link>
                </SidebarMenuItem>
              )}

              {menuItems.map((item) => {
                if (item.devOnly && !devOverride) return null;
                if (item.premium && !isPremium && !devOverride) return null;

                return (
                  <SidebarMenuItem key={item.page}>
                    <Link to={createPageUrl(item.page)}>
                      <SidebarMenuButton
                        isActive={currentPageName === item.page}
                        className="w-full justify-start"
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}

              <SidebarMenuItem className="mt-4 pt-4 border-t">
                <SidebarMenuButton onClick={handleLogout} className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-6 md:mb-4">
              <SidebarTrigger />
            </div>
            {children}
          </div>
        </main>
      </div>
      <PWAInstallPrompt />
      <EmbeddedBrowserDetector />
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          loadUser();
        }}
        user={user}
      />
      <WhatsNewDialog
        open={showWhatsNew}
        onClose={async () => {
          setShowWhatsNew(false);
          // Mark as seen
          if (user) {
            try {
              await base44.auth.updateMe({ last_seen_version: CURRENT_VERSION });
            } catch (error) {
              console.error('Failed to update version:', error);
            }
          }
        }}
      />
    </SidebarProvider>
  );
}