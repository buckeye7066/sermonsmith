import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeProvider.jsx';
import PrimaryNav from './PrimaryNav.jsx';
import WorkspaceHome from '../pages/WorkspaceHome.jsx';
import Present from '../pages/Present.jsx';
import FriendlyNotFound from './FriendlyNotFound.jsx';

// WorkspaceShell gives the everyday, non-technical experience: the persistent
// primary nav plus the Home screen and the not-yet-built pages. It is designed
// to be mounted alongside (not in place of) the app's existing routes so that
// existing sermons, studies, and drafts stay reachable through their own paths.
//
// Usage inside the existing app router, e.g. in App.jsx:
//   <Route path="/*" element={<WorkspaceShell />} />
// or mount WorkspaceHome / Present / PrimaryNav individually. The nav links
// point at the app's real existing pages (Reader, BibleStudy, SermonBuilder,
// PlanLibrary, SermonLibrary), which the outer router already renders.
export default function WorkspaceShell() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <PrimaryNav />
        <Routes>
          <Route index element={<WorkspaceHome />} />
          <Route path="/" element={<WorkspaceHome />} />
          <Route path="/home" element={<WorkspaceHome />} />
          <Route path="/present" element={<Present />} />
          <Route path="*" element={<FriendlyNotFound />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
}
