import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { navItems } from '../config/navItems';
import { placeholders, getPlaceholder } from '../config/placeholders';
import { assistants } from '../config/assistants';
import PrimaryNav from '../components/PrimaryNav';
import HomePage from '../pages/HomePage';
import PlaceholderPage from '../pages/PlaceholderPage';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

function renderWithRouter(ui, initialEntries = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('navItems config', () => {
  it('exposes the six workflow areas', () => {
    const labels = navItems.map((n) => n.label);
    expect(labels).toContain('Read Scripture');
    expect(labels).toContain('Study');
    expect(labels).toContain('Build Sermon/Lesson');
    expect(labels).toContain('Plan Series');
    expect(labels).toContain('Library');
    expect(labels).toContain('Present');
  });

  it('contains NO admin or developer links', () => {
    for (const item of navItems) {
      const haystack = `${item.route} ${item.label} ${item.id}`.toLowerCase();
      expect(haystack).not.toContain('admin');
      expect(haystack).not.toContain('developer');
      expect(haystack).not.toContain('function-tester');
      expect(haystack).not.toContain('grant-access');
    }
  });

  it('gives every not-yet-built route friendly placeholder content', () => {
    for (const item of navItems) {
      if (item.isBuilt) continue;
      const content = getPlaceholder(item.route);
      expect(content.comingSoonMessage).toBeTruthy();
      expect(content.whatYouCanDoNow).toBeTruthy();
    }
  });
});

describe('PrimaryNav', () => {
  it('renders a link for each workflow area and no admin links', () => {
    renderWithRouter(<PrimaryNav />);
    for (const item of navItems) {
      expect(screen.getByRole('link', { name: new RegExp(item.label, 'i') })).toBeTruthy();
    }
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });
});

describe('HomePage', () => {
  it('shows the headline, purpose, and start buttons', () => {
    renderWithRouter(<HomePage />);
    expect(screen.getByRole('heading', { name: /welcome to sermonsmith/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /read scripture/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /study/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /build sermon\/lesson/i }).length).toBeGreaterThan(0);
  });

  it('describes Larry and Arlynn in plain sentences', () => {
    renderWithRouter(<HomePage />);
    for (const a of assistants) {
      expect(screen.getByText(a.oneLineDescription)).toBeTruthy();
    }
  });
});

describe('PlaceholderPage', () => {
  it('shows coming-soon message and a way back to Home for an unbuilt route', () => {
    const target = placeholders[0];
    renderWithRouter(
      <Routes>
        <Route path={target.route} element={<PlaceholderPage route={target.route} />} />
      </Routes>,
      [target.route],
    );
    expect(screen.getByText(target.comingSoonMessage)).toBeTruthy();
    expect(screen.getByText(target.whatYouCanDoNow)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to home/i })).toBeTruthy();
  });

  it('falls back to a generic friendly message for an unknown route', () => {
    const content = getPlaceholder('/totally-unknown');
    expect(content.areaName).toBeTruthy();
    expect(content.comingSoonMessage).toBeTruthy();
    expect(content.whatYouCanDoNow).toBeTruthy();
  });
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch (e) {
      /* ignore */
    }
    document.documentElement.classList.remove('dark');
  });

  function Probe() {
    const { mode, toggle } = useTheme();
    return (
      <div>
        <span data-testid="mode">{mode}</span>
        <button onClick={toggle}>toggle-theme</button>
      </div>
    );
  }

  it('toggles the theme and persists the choice to localStorage', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    const before = screen.getByTestId('mode').textContent;
    fireEvent.click(screen.getByRole('button', { name: /toggle-theme/i }));
    const after = screen.getByTestId('mode').textContent;
    expect(after).not.toEqual(before);
    expect(window.localStorage.getItem('sermonsmith.theme')).toEqual(after);
  });
});
