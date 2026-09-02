import React, { Suspense, useEffect } from 'react'
import { lazyWithReload as lazy } from '@/lib/lazyWithReload'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, hasAuthSessionHint, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { OfflineProvider } from '@/lib/offlineDetector.jsx';
import OfflineBanner from '@/components/OfflineBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminGuard from '@/components/AdminGuard';
import EntitlementGuard from '@/components/EntitlementGuard';

// Pages that must never render their UI to a non-admin. The API also enforces
// this server-side; gating here stops the admin shell (search boxes, user
// tables, action buttons) from ever mounting for a regular signed-in user.
const ADMIN_PAGES = new Set([
  'AdminUsers',
  'AdminAnalytics',
  'AdminMessages',
  'AdminFunctionTester',
  'AdminImport',
  'FunctionReviewer',
  'GrantAccess',
  'BibleAPITest',
  'ImportStatus',
]);

const PAGE_ENTITLEMENTS = new Map([
  ['BibleMaps', 'bible_maps'],
  ['ChristianEthics', 'ethics'],
  ['Community', 'community'],
  ['Forum', 'community'],
  ['StudyGroups', 'community'],
  ['GroupDetail', 'community'],
  ['SharedContent', 'community'],
  ['SermonLibrary', 'community'],
  ['PlanLibrary', 'community'],
  ['WorldviewExplorer', 'worldview'],
  ['CollaborativeSermonEditor', 'collaboration'],
]);


const SITE_ORIGIN = 'https://sermonsmith.axiombiolabs.org';
const SOCIAL_IMAGE = `${SITE_ORIGIN}/icon.png`;

const HOME_METADATA = {
  title: 'SermonSmith | AI-Assisted Sermon Builder & Bible Study Tools',
  description: 'Draft and revise sermons, organize Bible-study notes, compare study prompts, and use an honest elapsed-time presentation coach. Verify all AI output and Scripture references before teaching.',
  path: '/',
};

const PUBLIC_ROUTE_METADATA = {
  '/': HOME_METADATA,
  '/home': HOME_METADATA,
  '/pricing': {
    title: 'SermonSmith Pricing | Plans for Sermon & Bible Study Tools',
    description: 'Compare SermonSmith plans for editable sermon drafts, Bible-study tools, and elapsed-time presentation coaching, with clear feature and source limitations.',
    path: '/Pricing',
  },
  '/downloads': {
    title: 'SermonSmith Scripture Sources & Offline Use',
    description: 'Understand which Scripture sources SermonSmith can use, what offline access depends on, and why every passage and translation must be verified.',
    path: '/Downloads',
  },
  '/privacy': {
    title: 'SermonSmith Privacy Policy',
    description: 'Read how SermonSmith handles account data, saved ministry content, AI requests, operational activity, service providers, retention, and deletion requests.',
    path: '/privacy',
  },
  '/terms': {
    title: 'SermonSmith Terms of Use',
    description: 'Read the SermonSmith terms covering acceptable use, AI draft limitations, Scripture source verification, billing, and pastoral responsibility.',
    path: '/terms',
  },
};

export function metadataForPath(pathname) {
  return PUBLIC_ROUTE_METADATA[String(pathname || '/').toLowerCase()] || null;
}

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    const match = selector.match(/meta\[(name|property)="([^"]+)"\]/);
    if (!match) return;
    element.setAttribute(match[1], match[2]);
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function updateStructuredData(metadata, canonicalUrl) {
  let script = document.getElementById('route-structured-data');
  if (!metadata) {
    script?.remove();
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.id = 'route-structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(
    metadata.path === '/'
      ? {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'SermonSmith',
          url: canonicalUrl,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          description: metadata.description,
          creator: { '@type': 'Person', name: 'Dr. John White' },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: metadata.title,
          url: canonicalUrl,
          description: metadata.description,
          isPartOf: {
            '@type': 'WebSite',
            name: 'SermonSmith',
            url: `${SITE_ORIGIN}/`,
          },
        },
  );
}

export function RouteMetadata() {
  const location = useLocation();
  const { pathname, search } = location;

  useEffect(() => {
    const metadata = metadataForPath(pathname);
    const canonical = document.head.querySelector('link[rel="canonical"]');

    if (!metadata) {
      document.title = 'SermonSmith Application';
      setMeta('meta[name="description"]', 'content', 'Signed-in SermonSmith application.');
      setMeta('meta[name="robots"]', 'content', 'noindex,nofollow,noarchive');
      canonical?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
      document.head.querySelector('meta[property="og:image"]')?.remove();
      document.head.querySelector('meta[property="og:image:alt"]')?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
      updateStructuredData(null, null);
      setMeta('meta[property="og:title"]', 'content', 'SermonSmith Application');
      setMeta('meta[property="og:description"]', 'content', 'Signed-in SermonSmith application.');
      setMeta('meta[name="twitter:title"]', 'content', 'SermonSmith Application');
      setMeta('meta[name="twitter:description"]', 'content', 'Signed-in SermonSmith application.');
      return;
    }

    const canonicalUrl = new URL(metadata.path, SITE_ORIGIN).href;
    document.title = metadata.title;
    setMeta('meta[name="description"]', 'content', metadata.description);
    setMeta('meta[name="robots"]', 'content', 'index,follow,max-image-preview:large');
    setMeta('meta[property="og:title"]', 'content', metadata.title);
    setMeta('meta[property="og:description"]', 'content', metadata.description);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[property="og:image"]', 'content', SOCIAL_IMAGE);
    setMeta('meta[property="og:image:alt"]', 'content', 'SermonSmith application icon');
    setMeta('meta[name="twitter:title"]', 'content', metadata.title);
    setMeta('meta[name="twitter:description"]', 'content', metadata.description);
    setMeta('meta[name="twitter:image"]', 'content', SOCIAL_IMAGE);
    updateStructuredData(metadata, canonicalUrl);

    const canonicalLink = canonical || document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    canonicalLink.setAttribute('href', canonicalUrl);
    if (!canonical) document.head.appendChild(canonicalLink);
  }, [pathname, search]);

  return null;
}

const Login = lazy(() => import('./pages/Login'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;
const Router = isElectron ? HashRouter : BrowserRouter;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function loginRedirectFor(location) {
  const returnTo = `${location.pathname}${location.search}${location.hash}` || '/';
  return `/Login?return=${encodeURIComponent(returnTo)}`;
}

export const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, authError } = useAuth();
  const location = useLocation();

  // Public routes must render before auth initialization finishes. Previously the
  // global auth gate redirected every logged-out path except /privacy to Login,
  // which made the landing and pricing pages unusable as public web pages.
  const publicPath = location.pathname.toLowerCase();
  const PublicPage =
    publicPath === '/' || publicPath === '/home'
      ? Pages.Home
      : publicPath === '/pricing'
        ? Pages.Pricing
        : publicPath === '/downloads'
          ? Pages.Downloads
          : null;

  if (publicPath === '/privacy') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PrivacyPolicy />
      </Suspense>
    );
  }

  if (publicPath === '/terms') {
    return (
      <Suspense fallback={<PageLoader />}>
        <TermsOfUse />
      </Suspense>
    );
  }

  // Login / register / forgot / reset must render before the auth gate finishes.
  // Returning-session hints still wait on the loader so a signed-in user does
  // not flash the marketing/login shell before cookie verification completes.
  if (publicPath === '/login') {
    if (isLoadingAuth && hasAuthSessionHint()) {
      return <PageLoader />;
    }
    if (isLoadingAuth || !isAuthenticated) {
      return (
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      );
    }
  }

  // An anonymous browser with no prior authenticated-session hint gets the
  // public page immediately. A returning browser waits on the neutral loader
  // until its httpOnly cookie is verified, preventing a marketing-shell flash
  // before the signed-in layout appears. A stale hint is cleared by a 401.
  if (PublicPage && isLoadingAuth && hasAuthSessionHint()) {
    return <PageLoader />;
  }

  // Logged-out visitors get a marketing page without the authenticated app
  // shell. Signed-in users continue through to the normal routed experience.
  if (PublicPage && (isLoadingAuth || !isAuthenticated)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <PublicPage />
      </Suspense>
    );
  }

  if (isLoadingAuth) {
    return <PageLoader />;
  }

  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/Login" element={<Login />} />
          <Route path="*" element={<Navigate to={loginRedirectFor(location)} replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/Login" element={<Login />} />
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            caseSensitive={false}
            element={
              <LayoutWrapper currentPageName={path}>
                {ADMIN_PAGES.has(path) ? (
                  <AdminGuard>
                    <Page />
                  </AdminGuard>
                ) : PAGE_ENTITLEMENTS.has(path) ? (
                  <EntitlementGuard entitlement={PAGE_ENTITLEMENTS.get(path)}>
                    <Page />
                  </EntitlementGuard>
                ) : (
                  <Page />
                )}
              </LayoutWrapper>
            }
          />
        ))}
        {/* The sidebar labels the reader "Bible Reader" (route is /Reader), so
            users who guess /BibleReader from the label hit a 404. Redirect it. */}
        <Route path="/BibleReader" element={<Navigate to="/Reader" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <OfflineProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <NavigationTracker />
              <RouteMetadata />
              <OfflineBanner />
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </QueryClientProvider>
        </AuthProvider>
      </OfflineProvider>
    </ErrorBoundary>
  )
}

export default App
