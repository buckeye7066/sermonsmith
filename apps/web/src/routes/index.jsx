import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { navItems } from '../config/navItems.js';
import HomePage from '../pages/HomePage.jsx';
import PlaceholderPage from '../pages/PlaceholderPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import ReadScripturePage from '../pages/workflow/ReadScripturePage.jsx';
import StudyPage from '../pages/workflow/StudyPage.jsx';
import BuildSermonPage from '../pages/workflow/BuildSermonPage.jsx';
import PlanSeriesPage from '../pages/workflow/PlanSeriesPage.jsx';
import LibraryPage from '../pages/workflow/LibraryPage.jsx';

// Maps a built NavItem route to its real page component.
const BUILT_PAGES = {
  '/read': ReadScripturePage,
  '/study': StudyPage,
  '/build': BuildSermonPage,
  '/plan': PlanSeriesPage,
  '/library': LibraryPage,
};

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {navItems.map((item) => {
        if (item.isBuilt && BUILT_PAGES[item.route]) {
          const Page = BUILT_PAGES[item.route];
          return <Route key={item.id} path={item.route} element={<Page />} />;
        }
        return (
          <Route
            key={item.id}
            path={item.route}
            element={<PlaceholderPage route={item.route} />}
          />
        );
      })}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
