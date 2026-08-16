import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import * as ThemeProviderModule from './theme/ThemeProvider';
import * as RoutesModule from './routes/routes';
import * as PlaceholderModule from './data/placeholders';

const THEME_STORAGE_KEY = 'sermonsmith.theme';
const ThemeProvider =
  ThemeProviderModule.ThemeProvider ||
  ThemeProviderModule.default ||
  (({ children }) => <>{children}</>);

const workflowRoutes =
  RoutesModule.workflowRoutes ||
  RoutesModule.routes ||
  RoutesModule.primaryRoutes ||
  RoutesModule.default ||
  [];

function getPlaceholderEntries() {
  const source =
    PlaceholderModule.placeholders ||
    PlaceholderModule.placeholderPages ||
    PlaceholderModule.default ||
    [];

  if (Array.isArray(source)) {
    return source;
  }

  return Object.values(source);
}

function renderAppAt(route = '/') {
  window.history.pushState({}, 'SermonSmith test page', route);

  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function getThemeToggle() {
  return screen.getByRole('button', { name: /theme|dark|light/i });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ordinary ministry workflow', () => {
  it('welcomes a first-time visitor with a plain purpose and three obvious next steps', () => {
    renderAppAt('/');

    expect(screen.getByRole('heading', { name: /sermonsmith/i })).toBeInTheDocument();
    expect(
      screen.getByText(/calm, plain-language workspace for preparing sermons and bible lessons/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /read scripture|start reading|reading/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /study|start studying|studying/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /build sermon|build a message|building/i }),
    ).toBeInTheDocument();
  });

  it('explains Larry and Arlynn in one plain sentence each on the Home screen', () => {
    renderAppAt('/');

    expect(screen.getByText(/what can larry and arlynn do\?/i)).toBeInTheDocument();
    expect(screen.getByText(/larry/i)).toBeInTheDocument();
    expect(screen.getByText(/single sermon|single message|single lesson/i)).toBeInTheDocument();
    expect(screen.getByText(/arlynn/i)).toBeInTheDocument();
    expect(screen.getByText(/multi-week series|multi week series|series plan/i)).toBeInTheDocument();
  });

  it('renders every ordinary primary navigation route with a real page', () => {
    const visibleRoutes = workflowRoutes.filter((route) => route.visibleToOrdinaryUser === true);

    expect(visibleRoutes.map((route) => route.label)).toEqual(
      expect.arrayContaining([
        'Read Scripture',
        'Study',
        'Build Sermon/Lesson',
        'Plan Series',
        'Library',
        'Present',
      ]),
    );

    for (const route of visibleRoutes) {
      cleanup();
      renderAppAt(route.route);

      expect(document.body.textContent.trim().length).toBeGreaterThan(0);
      expect(screen.getByText(route.description)).toBeInTheDocument();
    }
  });

  it('keeps admin and developer-only links out of the ordinary primary navigation', () => {
    renderAppAt('/');

    const nav = screen.getAllByRole('navigation')[0];
    const hiddenRoutes = workflowRoutes.filter((route) => route.visibleToOrdinaryUser === false);

    for (const route of hiddenRoutes) {
      expect(within(nav).queryByRole('link', { name: route.label })).not.toBeInTheDocument();
    }

    expect(within(nav).queryByText(/admin/i)).not.toBeInTheDocument();
    expect(within(nav).queryByText(/developer/i)).not.toBeInTheDocument();
    expect(within(nav).queryByText(/function tester/i)).not.toBeInTheDocument();
  });
});

describe('theme preference', () => {
  it('switches between light and dark and remembers the choice for the next visit', async () => {
    const user = userEvent.setup();
    const firstVisit = renderAppAt('/');

    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(getThemeToggle());

    expect(document.documentElement).toHaveClass('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY))).toEqual(
      expect.objectContaining({ mode: 'dark', isDefault: false }),
    );

    firstVisit.unmount();
    renderAppAt('/');

    expect(document.documentElement).toHaveClass('dark');
  });

  it('falls back to the light theme when saved theme data cannot be read', () => {
    localStorage.setItem(THEME_STORAGE_KEY, '{this is not saved theme data');

    expect(() => renderAppAt('/')).not.toThrow();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

describe('friendly placeholder and missing-page copy', () => {
  it('shows what unfinished areas will contain and what the user can do now', () => {
    const placeholders = getPlaceholderEntries();

    expect(placeholders.length).toBeGreaterThan(0);

    for (const placeholder of placeholders) {
      cleanup();
      renderAppAt(placeholder.route);

      expect(screen.getByRole('heading', { name: placeholder.title })).toBeInTheDocument();
      expect(screen.getByText(placeholder.comingSoonMessage)).toBeInTheDocument();
      expect(screen.getByText(placeholder.whatYouCanDoNow)).toBeInTheDocument();
    }
  });

  it('uses a calm missing-page message with a clear way back Home', () => {
    renderAppAt('/this-page-is-not-part-of-the-app');

    expect(screen.getByText(/couldn't find that page|could not find that page/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
  });
});
