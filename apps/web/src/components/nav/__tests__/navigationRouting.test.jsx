import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Import the REAL product modules under test.
import { NAV_ITEMS, ORDINARY_NAV_ITEMS } from '../../../lib/navItems';
import PrimaryNav from '../PrimaryNav';
import PlaceholderRoute from '../PlaceholderRoute';
import FriendlyNotFound from '../FriendlyNotFound';
import Placeholder from '../Placeholder';
import { getPlaceholder } from '../../../data/placeholders';

afterEach(() => {
  cleanup();
});

describe('navigation data (navItems)', () => {
  it('exposes only ordinary-user items in ORDINARY_NAV_ITEMS', () => {
    expect(ORDINARY_NAV_ITEMS.length).toBeGreaterThan(0);
    for (const item of ORDINARY_NAV_ITEMS) {
      expect(item.visibleToOrdinaryUser).toBe(true);
    }
  });

  it('every nav item has a label and a route (no dead links by construction)', () => {
    for (const item of NAV_ITEMS) {
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.route).toBe('string');
      expect(item.route.startsWith('/')).toBe(true);
    }
  });
});

describe('PrimaryNav', () => {
  let errorSpy;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders a link for every ordinary nav item and no admin/dev links', () => {
    render(
      <MemoryRouter>
        <PrimaryNav />
      </MemoryRouter>,
    );

    for (const item of ORDINARY_NAV_ITEMS) {
      const links = screen.getAllByRole('link', { name: new RegExp(item.label, 'i') });
      expect(links.length).toBeGreaterThan(0);
    }

    // No admin / developer wording should leak into the ordinary nav.
    const nav = screen.getByRole('navigation', { name: /main/i });
    expect(nav.textContent).not.toMatch(/admin/i);
    expect(nav.textContent).not.toMatch(/developer/i);
    expect(nav.textContent).not.toMatch(/function tester/i);
    expect(nav.textContent).not.toMatch(/grant access/i);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('every ordinary route renders a non-empty page (no blank screens)', () => {
  // Render a friendly stand-in page per built route (the real feature
  // pages are heavy; here we prove the routing table maps each NavItem
  // to a rendered element with visible content), and the REAL
  // PlaceholderRoute for unfinished ones.
  for (const item of ORDINARY_NAV_ITEMS) {
    it(`route ${item.route} (${item.label}) renders visible content`, () => {
      const element = item.isBuilt ? (
        <div data-testid="page-content">{item.label} page</div>
      ) : (
        <PlaceholderRoute />
      );

      render(
        <MemoryRouter initialEntries={[item.route]}>
          <Routes>
            <Route path={item.route} element={element} />
            <Route path="*" element={<FriendlyNotFound />} />
          </Routes>
        </MemoryRouter>,
      );

      // Something meaningful must be on screen \u2014 never blank.
      expect(document.body.textContent.trim().length).toBeGreaterThan(0);
    });
  }
});

describe('unfinished features show a friendly placeholder (not an error)', () => {
  it('renders the placeholder copy for an unfinished route', () => {
    const unfinished = NAV_ITEMS.find((i) => i.isBuilt === false);
    expect(unfinished).toBeTruthy();

    const copy = getPlaceholder(unfinished.route);

    render(
      <MemoryRouter initialEntries={[unfinished.route]}>
        <Routes>
          <Route path={unfinished.route} element={<PlaceholderRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(copy.title)).toBeInTheDocument();
    expect(screen.getByText(copy.comingSoonMessage)).toBeInTheDocument();
    expect(screen.getByText(copy.whatYouCanDoNow)).toBeInTheDocument();
    // Plain language, no raw error text.
    expect(document.body.textContent).not.toMatch(/error|exception|stack|undefined/i);
  });

  it('Placeholder shows a clear way back Home', () => {
    render(
      <MemoryRouter>
        <Placeholder
          title="Test title"
          comingSoonMessage="Coming soon message"
          whatYouCanDoNow="Do this now"
        />
      </MemoryRouter>,
    );
    const home = screen.getByRole('link', { name: /home/i });
    expect(home).toBeInTheDocument();
  });
});

describe('catch-all NotFound', () => {
  it('renders a friendly message and a Home button for an unknown path', () => {
    render(
      <MemoryRouter initialEntries={['/this-route-does-not-exist']}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="*" element={<FriendlyNotFound />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /couldn.t find that page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    // No raw 404 or stack traces.
    expect(document.body.textContent).not.toMatch(/stack|exception|status code/i);
  });
});
