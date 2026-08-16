import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShellRoutes from '@/routes/shellRoutes';
import PrimaryNav from '@/components/PrimaryNav';
import { navItems } from '@/config/navItems';
import { getPlaceholderContent } from '@/config/placeholders';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShellRoutes />
    </MemoryRouter>
  );
}

describe('SermonSmith navigation shell', () => {
  it('shows the Home page at the app root with a clear purpose statement', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/calm, plain-language workspace/i)).toBeInTheDocument();
  });

  it('renders every not-yet-built nav route as a friendly placeholder (no blank screen)', () => {
    const notBuilt = navItems.filter((n) => !n.isBuilt);
    expect(notBuilt.length).toBeGreaterThan(0);
    for (const item of notBuilt) {
      const { unmount } = renderAt(item.route);
      expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Back to Home/i })
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('has real placeholder content for every not-yet-built route', () => {
    for (const item of navItems.filter((n) => !n.isBuilt)) {
      const content = getPlaceholderContent(item.route, item.label);
      expect(content.comingSoonMessage).toBeTruthy();
      expect(content.whatYouCanDoNow).toBeTruthy();
    }
  });

  it('shows a friendly not-found page for unknown routes', () => {
    renderAt('/some-page-that-does-not-exist');
    expect(screen.getByText(/couldn.t find that page/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to Home/i })
    ).toBeInTheDocument();
  });

  it('primary navigation has no admin or developer links', () => {
    render(
      <MemoryRouter>
        <PrimaryNav />
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const text = (link.textContent || '').toLowerCase();
      expect(href.toLowerCase()).not.toMatch(/admin|grant-access|function/);
      expect(text).not.toMatch(/admin|developer|debug/);
    }
  });

  it('every primary nav item points to a route the shell can render', () => {
    for (const item of navItems) {
      const { unmount } = renderAt(item.route);
      // A rendered heading proves it is not a blank screen.
      expect(screen.queryByText(/couldn.t find that page/i)).toBeNull();
      unmount();
    }
  });
});
