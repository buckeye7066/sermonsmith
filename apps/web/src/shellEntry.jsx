import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import ErrorBoundary from './components/shell/ErrorBoundary.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import AppShellApp from './AppShellApp.jsx';
import './index.css';

// Entry point for the new navigation shell.
// To use this shell as the app root, point index.html's module script at
// 'src/shellEntry.jsx'. HashRouter is used so deep links work on any static
// host with no server rewrite rules.
//
// Setup (from the repo root):
//   npm install
//   npm install react-router-dom lucide-react -w @sermonsmith/web
//   npm run dev        (starts the web app locally)
//   npm run build:web  (produces the deployable static site)

const rootEl = document.getElementById('root');

if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <HashRouter>
            <AppShellApp />
          </HashRouter>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
