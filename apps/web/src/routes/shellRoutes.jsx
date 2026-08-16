import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { navItems } from '@/config/navItems';
import WelcomeHome from '@/pages/WelcomeHome';
import PlaceholderPage from '@/pages/PlaceholderPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Lazy-load the existing real feature pages so this shell can route to them
// without pulling everything into the first render.
const realPages = {
  '/reader': lazy(() => import('@/pages/Reader')),
  '/bible-study': lazy(() => import('@/pages/BibleStudy')),
  '/sermon-builder': lazy(() => import('@/pages/SermonBuilder')),
  '/sermon-library': lazy(() => import('@/pages/SermonLibrary')),
};

function Loading() {
  return (
    <p className="text-lg text-slate-600 dark:text-slate-300">
      Loading&hellip; one moment.
    </p>
  );
}

// Builds the route for one nav item: real page if built and available,
// otherwise a friendly placeholder. Never leaves a route unhandled.
function renderNavElement(item) {
  if (item.isBuilt && realPages[item.route]) {
    const RealPage = realPages[item.route];
    return (
      <Suspense fallback={<Loading />}>
        <RealPage />
      </Suspense>
    );
  }
  return <PlaceholderPage route={item.route} areaName={item.label} />;
}

// The shell's route table. Use this inside an <AppShell> in App.
export default function ShellRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeHome />} />
      {navItems.map((item) => (
        <Route
          key={item.id}
          path={item.route}
          element={renderNavElement(item)}
        />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
