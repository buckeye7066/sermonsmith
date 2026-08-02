import React, { Suspense } from 'react'
import { lazyWithReload as lazy } from '@/lib/lazyWithReload'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { OfflineProvider } from '@/lib/offlineDetector.jsx';
import OfflineBanner from '@/components/OfflineBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminGuard from '@/components/AdminGuard';

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
]);

const Login = lazy(() => import('./pages/Login'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

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

  // Public, unauthenticated routes. Legal/store pages (e.g. the privacy policy
  // required by Google Play and the App Store) must render for anyone —
  // app-store reviewers and logged-out visitors — before the auth/loading
  // gate below, and without the authenticated app shell/navigation.
  if (location.pathname.toLowerCase() === '/privacy') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PrivacyPolicy />
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
            element={
              <LayoutWrapper currentPageName={path}>
                {ADMIN_PAGES.has(path) ? (
                  <AdminGuard>
                    <Page />
                  </AdminGuard>
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
