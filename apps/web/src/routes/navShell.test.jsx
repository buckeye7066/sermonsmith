import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from './index.jsx';
import PrimaryNav from '../components/shell/PrimaryNav.jsx';
import ThemeToggle from '../components/shell/ThemeToggle.jsx';
import { ThemeProvider } from '../theme/ThemeProvider.jsx';
import { navItems } from '../config/navItems.js';
import { getPlaceholder } from '../config/placeholders.js';

function renderAt(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('navigation shell routing', () => {
  it('renders the Home page at the root with the three starting buttons', () => {
    renderAt('/');
    expect(screen.getByText('Read Scripture', { selector: 'a' })).toBeTruthy();
    expect(screen.getByText('Study', { selector: 'a' })).toBeTruthy();
    expect(screen.getByText('Build Sermon/Lesson', { selector: 'a' })).toBeTruthy();
  });

  it('renders a real page for every primary navigation route (no blank screens)', () => {
    navItems.forEach((item) => {
      const { unmount, container } = renderAt(item.route);
      // Every route must render a heading of some kind.
      const heading = container.querySelector('h1');
      expect(heading).toBeTruthy();
      expect(heading.textContent.trim().length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('shows a friendly not-found screen for unknown routes', () => {
    renderAt('/this-does-not-exist');
    expect(screen.getByText(/couldn/i)).toBeTruthy();
    expect(screen.getByText('Go back to Home', { selector: 'a' })).toBeTruthy();
  });

  it('gives every not-yet-built route placeholder content', () => {
    navItems
      .filter((n) => !n.isBuilt)
      .forEach((n) => {
        const content = getPlaceholder(n.route);
        expect(content.comingSoonMessage.length).toBeGreaterThan(0);
        expect(content.whatYouCanDoNow.length).toBeGreaterThan(0);
      });
  });
});

describe('primary navigation content', () => {
  it('shows all six workflow items', () => {
    render(
      <MemoryRouter>
        <PrimaryNav />
      </MemoryRouter>,
    );
    expect(navItems).toHaveLength(6);
    navItems.forEach((item) => {
      expect(screen.getByText(item.label)).toBeTruthy();
    });
  });

  it('contains no admin or developer links', () => {
    const routes = navItems.map((n) => n.route.toLowerCase());
    routes.forEach((r) => {
      expect(r.includes('admin')).toBe(false);
      expect(r.includes('dev')).toBe(false);
    });
    const labels = navItems.map((n) => n.label.toLowerCase()).join(' ');
    expect(labels.includes('admin')).toBe(false);
  });
});

describe('theme toggle persistence', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch (e) {
      // ignore
    }
    document.documentElement.classList.remove('dark');
  });

  it('switches theme and saves the choice to localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    const saved = window.localStorage.getItem('sermonsmith.theme');
    expect(saved === 'light' || saved === 'dark').toBe(true);
  });
});
