import React from 'react';
import AppShell from './components/shell/AppShell.jsx';
import AppRoutes from './routes/index.jsx';

// This is the new plain-language navigation shell described in the spec.
// It is mounted from shellEntry.jsx and wraps the route table in the shell.
export default function AppShellApp() {
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
