import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NAV_ITEMS, getVisibleNavItems } from './routes.js';
import PrimaryNav from '../components/PrimaryNav.jsx';
import WorkspaceHome from '../pages/WorkspaceHome.jsx';
import Present from '../pages/Present.jsx';
import FriendlyNotFound from '../components/FriendlyNotFound.jsx';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from '../theme/ThemeProvider.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { ASSISTANTS } from '../data/assistants.js';

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('shared routes model', () => {
  it('includes the six ministry workflow areas in order', () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(ids).toEqual(['read', 'study', 'build', 'plan', 'library', 'present']);
  });

  it('every nav item has a non-empty label, route, and description', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.route.startsWith('/')).toBe(true);
      expect(item.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('never exposes admin or developer routes to ordinary users', () => {
    const visible = getVisibleNavItems();
    for (const item of visible) {
      expect(item.visibleToOrdinaryUser).toBe(true);
      expect(item.route.toLowerCase()).not.toContain('admin');
      expect(item.label.toLowerCase()).not.toContain('admin');
      expect(item.route.toLowerCase()).not.toContain('function-reviewer');
    }
  });
});

describe('PrimaryNav', () => {
  beforeEach(() => cleanup());

  it('renders a link for every visible nav item and no dead labels', () => {
    renderWithRouter(
      <ThemeProvider>
        <PrimaryNav />
      </ThemeProvider>,
    );
    for (const item of getVisibleNavItems()) {
      const link = screen.getByRole('link', { name: new RegExp(item.label, 'i') });
      expect(link).toHaveAttribute('href', item.route);
    }
  });

  it('does not render any admin link', () => {
    renderWithRouter(
      <ThemeProvider>
        <PrimaryNav />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });
});

describe('WorkspaceHome', () => {
  beforeEach(() => cleanup());

  it('shows the one-sentence purpose and three start buttons', () => {
    renderWithRouter(<WorkspaceHome />);
    expect(screen.getByText(/plain-language workspace/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /start reading/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /start studying/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /start building/i })).toBeTruthy();
  });

  it('describes both Larry and Arlynn in one plain sentence each', () => {
    renderWithRouter(<WorkspaceHome />);
    for (const a of ASSISTANTS) {
      expect(screen.getByText(a.oneLineDescription)).toBeTruthy();
    }
    expect(screen.getByText(/what can larry and arlynn do/i)).toBeTruthy();
  });
});

describe('unfinished feature pages', () => {
  beforeEach(() => cleanup());

  it('Present shows friendly coming-soon copy, never an error', () => {
    renderWithRouter(<Present />);
    expect(screen.getByText(/what you can do right now/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to home/i })).toBeTruthy();
  });
});

describe('FriendlyNotFound', () => {
  beforeEach(() => cleanup());

  it('shows a calm message and a way back home', () => {
    renderWithRouter(<FriendlyNotFound />);
    expect(screen.getByText(/couldn.t find that page/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to home/i })).toBeTruthy();
  });
});

describe('theme preference', () => {
  beforeEach(() => {
    cleanup();
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    document.documentElement.classList.remove('dark');
  });

  it('toggles between light and dark and persists the choice', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    // Default is light: the button offers to switch to dark.
    const toDark = screen.getByRole('button', { name: /switch to dark/i });
    fireEvent.click(toDark);

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const saved = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
    expect(saved.mode).toBe('dark');
    expect(saved.isDefault).toBe(false);
  });

  it('falls back to light when stored data is corrupt', () => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, 'not-json');
    } catch {
      /* ignore */
    }

    function Probe() {
      const { mode } = useTheme();
      return <span>mode:{mode}</span>;
    }

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('mode:light')).toBeTruthy();
  });
});
