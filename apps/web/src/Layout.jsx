import React from 'react';
import AppShell from './components/AppShell';

export default function Layout({ children }) {
  return <AppShell>{children}</AppShell>;
}

export { Layout };
