import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { createPageUrl } from './utils';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Book, FileText, Settings, PlusCircle, MapPin, GraduationCap, Crown, LogOut, Home, Brain, BookOpen, Users, Globe, Scale, Heart, MessageSquare, Shield, Code } from 'lucide-react';
import { SafeImg } from '@/components/ui/SafeImg';
import { toast } from 'sonner';
import { usePremiumAccess } from './components/hooks/usePremiumAccess';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OnboardingWizard from './components/profile/OnboardingWizard';
import EmbeddedBrowserDetector from './components/EmbeddedBrowserDetector';
import WhatsNewDialog, { CURRENT_VERSION } from './components/WhatsNewDialog';
import { isNativeApp } from './lib/platform';

// The app logo is served as an SVG from /public so it works without an
// external image host. We also keep a remote-friendly PNG fallback path in
// the manifest so installed PWAs that don't yet support SVG icons still get
// a usable image.
const APP_ICON_URL = '/icon.png';

export default function Layout({ children, currentPageName }) {
  // Auth state comes from the single AuthContext fetch — DO NOT call
  // api.auth.me() here. The legacy code path triggered /api/auth/me 4×
  // per page load (AuthProvider + Layout + Layout-via-usePremiumAccess +
  // page-via-usePremiumAccess). All consumers now read the cached user.
  const { user, isLoadingAuth, checkAppState } = useAuth();
  const { isPremium, devOverride, loading: accessLoading } = usePremiumAccess();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Track which one-shot side effects we've already fired for this user so
  // an auth refresh doesn't re-toast / re-clear the special message.
  const [hasShownOnboarding, setHasShownOnboarding] = useState(false);
  const [hasShownSpecial, setHasShownSpecial] = useState(false);

  useEffect(() => {
    // PWA manifest is now served as a static file from
    // apps/web/public/manifest.webmanifest and referenced from index.html.
    // The previous dynamic data-URI manifest was fragile for install
    // prompts, crawler discovery, and the iOS/Android install banner
    // heuristics. Mobile meta tags below remain runtime-added so we can
    // tweak the viewport on iOS in-app browsers.

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

    // Cross-browser localStorage availability check for iOS in-app browsers
    try {
      localStorage.setItem("__storage_test__", "1");
      localStorage.removeItem("__storage_test__");
    } catch (e) {
      console.warn("localStorage unavailable — some preferences may not persist across sessions");
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
      link.href = APP_ICON_URL;
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
        const match = verse.match(/(.+?)\s+(\d+):(\d+)/);
        if (match) {
          const [, book, chapter, verseNum] = match;
          window.location.href = `/Reader?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verseNum}`;
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

  // Once auth has loaded and we have a user, run the one-shot "first
  // visit" / "special message" / "what's new" checks. Guarded by
  // `hasShown*` so they don't replay if AuthContext refreshes the user.
  useEffect(() => {
    if (isLoadingAuth || !user) return;

    if (!user.onboarding_completed && !hasShownOnboarding) {
      setHasShownOnboarding(true);
      const t = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(t);
    }

    if (user.onboarding_completed && !hasShownSpecial) {
      setHasShownSpecial(true);

      if (user.special_message) {
        const t = setTimeout(() => {
          toast.success(user.special_message, {
            duration: 8000,
            className: 'text-lg',
          });
          api.auth.updateMe({ special_message: null }).catch(() => {});
        }, 1000);
        return () => clearTimeout(t);
      }

      const lastSeenVersion = user.last_seen_version || '';
      if (lastSeenVersion !== CURRENT_VERSION) {
        const t = setTimeout(() => setShowWhatsNew(true), 1500);
        return () => clearTimeout(t);
      }
    }
  }, [isLoadingAuth, user, hasShownOnboarding, hasShownSpecial]);

  const handleLogout = () => {
    api.auth.logout();
    toast.success("Logged out successfully");
    window.location.href = '/Login';
  };

  const handleLogin = async () => {
    try {
      // Handle in-app browser login issues (Facebook, Instagram, Messenger, etc.)
      const ua = navigator.userAgent || "";
      const isInApp = /FBAN|FBAV|Instagram|Messenger|Line|TikTok|Snapchat|WebView|wv\)/i.test(ua);
      
      if (isInApp) {
        window.location.href = window.location.origin + '/Login';
      } else {
        api.auth.redirectToLogin();
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
    { name: 'Bible Maps', icon: MapPin, page: 'BibleMaps', premium: true },
    { name: 'Christian Ethics', icon: Scale, page: 'ChristianEthics' },
    { name: 'Community', icon: Users, page: 'Community', premium: true },
    { name: 'Worldview Explorer', icon: Globe, page: 'WorldviewExplorer', premium: true },
    { name: 'Contact Support', icon: MessageSquare, page: 'ContactSupport' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
    { name: 'Admin Messages', icon: MessageSquare, page: 'AdminMessages', devOnly: true },
    { name: 'Admin Users', icon: Users, page: 'AdminUsers', devOnly: true },
    { name: 'Admin Analytics', icon: Brain, page: 'AdminAnalytics', devOnly: true },
    { name: 'Function Tester', icon: Shield, page: 'AdminFunctionTester', devOnly: true },
        { name: 'Function Reviewer', icon: Code, page: 'FunctionReviewer', devOnly: true }
  ];

  if (isLoadingAuth || accessLoading) {
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
            src={APP_ICON_URL}
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
      <div className="flex h-screen w-full overflow-hidden bg-gray-50" data-app-shell>
        <Sidebar className="border-r border-gray-200 hidden md:flex">
          <SidebarHeader className="border-b border-gray-200 p-4 group-data-[state=closed]/sidebar:px-3">
            <div className="flex min-w-0 items-center gap-3 group-data-[state=closed]/sidebar:justify-center">
              <SafeImg
                src={APP_ICON_URL}
                alt="SermonSmith"
                className="h-10 w-10 shrink-0 rounded-full"
                useFallbackIcon={true}
              />
              <div className="min-w-0 group-data-[state=closed]/sidebar:hidden">
                <h1 className="truncate text-xl font-bold text-gray-900">SermonSmith</h1>
                <p className="text-sm text-gray-500 truncate">{user.full_name || user.email}</p>
                {devOverride && (
                  <p className="text-xs text-yellow-600 font-medium">Developer Access</p>
                )}
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarMenu>
              {/* Store policy: native builds never show upgrade CTAs. */}
              {!isPremium && !isNativeApp() && (
                <SidebarMenuItem className="mb-4">
                  <Link to={createPageUrl('Pricing')} className="block w-full">
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
                    {/* Link renders an <a>, which defaults to display:inline and
                        gives the w-full button no width to fill (labels collapse to
                        a ~20px column). block + w-full makes the anchor a full-width
                        block so every nav row lays out on a single line. This is the
                        shared render path for all nav items, so the fix applies once. */}
                    <Link to={createPageUrl(item.page)} className="block w-full">
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

        <main className="min-w-0 flex-1 overflow-auto pb-16 md:pb-0">
          <div className="w-full p-4 md:p-6">
            <div className="flex items-center justify-between mb-6 md:mb-4">
              <SidebarTrigger />
            </div>
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden z-50 safe-area-bottom">
          <div className="grid grid-cols-5 h-16">
            {[
              { icon: Home, label: 'Home', page: 'Home' },
              { icon: Book, label: 'Bible', page: 'Reader' },
              { icon: FileText, label: 'Sermon', page: 'SermonBuilder' },
              { icon: GraduationCap, label: 'Study', page: 'BibleStudy' },
              { icon: Settings, label: 'More', page: 'Settings' },
            ].map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : ''}`} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <PWAInstallPrompt />
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          // Pull fresh user state through the shared AuthContext rather
          // than firing another local api.auth.me() call.
          checkAppState?.();
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
              await api.auth.updateMe({ last_seen_version: CURRENT_VERSION });
            } catch (error) {
              console.error('Failed to update version:', error);
            }
          }
        }}
      />
    </SidebarProvider>
  );
}
