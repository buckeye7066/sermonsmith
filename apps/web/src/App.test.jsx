// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';

let authState;
let authSessionHint;

vi.mock('@/lib/AuthContext', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => authState,
  hasAuthSessionHint: () => authSessionHint,
}));

vi.mock('./pages.config', () => {
  const Home = () => <h1>SermonSmith Home</h1>;
  const Pricing = () => <h1>Choose Your Plan</h1>;
  const Downloads = () => <h1>Scripture Downloads</h1>;
  const SharedContent = ({ publicShareOnly }) => (
    <div data-testid="shared-content">{publicShareOnly ? 'Public shared resource' : 'Community feed'}</div>
  );
  const ProtectedPage = () => <div data-testid="protected-page">Protected page</div>;
  const CommunityRetraction = () => <div data-testid="community-retraction">My community content</div>;
  const Layout = ({ children }) => <div data-testid="layout">{children}</div>;

  return {
    pagesConfig: {
      mainPage: 'Home',
      Pages: {
        Home,
        Pricing,
        Downloads,
        SharedContent,
        Reader: ProtectedPage,
        SermonBuilder: ProtectedPage,
        MyCommunityContent: CommunityRetraction,
      },
      Layout,
    },
  };
});

vi.mock('@/components/UserNotRegisteredError', () => ({
  default: () => <div data-testid="user-not-registered">User not registered</div>,
}));

vi.mock('@/lib/maintenance', () => ({
  LOGIN_MAINTENANCE: { active: false, title: '', message: '', etaText: '' },
}));

import { AuthenticatedApp, metadataForPath, RouteMetadata } from './App.jsx';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

function MetadataNavigationProbe() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="metadata-location">{`${location.pathname}${location.search}${location.hash}`}</div>
      <button
        type="button"
        onClick={() => {
          document.title = 'Login | SermonSmith';
          navigate('/Login?mode=register');
        }}
      >
        Add register query
      </button>
      <button type="button" onClick={() => navigate('/Reader')}>Open protected route</button>
      <button type="button" onClick={() => navigate('/')}>Return home</button>
    </>
  );
}

function renderWithRoute(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LocationProbe />
      <AuthenticatedApp />
    </MemoryRouter>,
  );
}

describe('AuthenticatedApp route gating', () => {
  beforeEach(() => {
    cleanup();
    authSessionHint = false;
    document.head.innerHTML = '<title></title>';
    authState = {
      isAuthenticated: false,
      isLoadingAuth: false,
      authError: null,
      checkAppState: vi.fn(),
    };
  });

  it('keeps the landing page public while auth initializes', () => {
    authState.isLoadingAuth = true;
    renderWithRoute('/');

    expect(screen.getByRole('heading', { name: /sermonsmith home/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
  });

  it('uses a neutral loader for a known returning session while auth resolves', () => {
    authSessionHint = true;
    authState.isLoadingAuth = true;
    const view = renderWithRoute('/Home');

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sermonsmith home/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();

    authState = {
      ...authState,
      isAuthenticated: true,
      isLoadingAuth: false,
    };
    view.rerender(
      <MemoryRouter initialEntries={['/Home']}>
        <LocationProbe />
        <AuthenticatedApp />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /sermonsmith home/i })).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it.each(['/Pricing', '/pricing'])('keeps %s public for logged-out visitors', (route) => {
    renderWithRoute(route);

    expect(screen.getByRole('heading', { name: /choose your plan/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(route);
    expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('keeps the downloads information page public', () => {
    renderWithRoute('/Downloads');

    expect(screen.getByRole('heading', { name: /scripture downloads/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/Downloads');
  });

  it('opens a tokenized public share without authentication or the Community shell', () => {
    renderWithRoute('/SharedContent?link=sermon-safe-token');

    expect(screen.getByTestId('shared-content')).toHaveTextContent('Public shared resource');
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/SharedContent?link=sermon-safe-token');
  });

  it('keeps Login/register reachable while auth initializes', async () => {
    authState.isLoadingAuth = true;
    renderWithRoute('/Login?mode=register');

    expect(await screen.findByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/Login?mode=register');
  });

  it('keeps Terms public without authentication', async () => {
    renderWithRoute('/terms');

    expect(await screen.findByRole('heading', { name: /terms of use/i })).toBeInTheDocument();
  });

  it('supports a direct registration URL', async () => {
    renderWithRoute('/Login?mode=register');

    expect(await screen.findByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/Login?mode=register');
  });

  it('preserves an intended protected route as a return URL', async () => {
    renderWithRoute('/SermonBuilder?draft=1');

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
    await waitFor(() => {
      const location = screen.getByTestId('location').textContent;
      const params = new URLSearchParams(location.split('?')[1]);
      expect(location.startsWith('/Login?')).toBe(true);
      expect(params.get('return')).toBe('/SermonBuilder?draft=1');
    });
  });

  it('does not flicker protected content during auth loading', () => {
    authState.isLoadingAuth = true;
    renderWithRoute('/SermonBuilder');

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('renders protected routes only when authenticated', async () => {
    authState.isAuthenticated = true;
    renderWithRoute('/SermonBuilder');

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('keeps the signed-in community retraction surface outside the Premium gate', async () => {
    authState.isAuthenticated = true;
    renderWithRoute('/MyCommunityContent');

    expect(await screen.findByTestId('community-retraction')).toBeInTheDocument();
    expect(screen.queryByText(/premium feature/i)).not.toBeInTheDocument();
  });

  it('renders the signed-in Home inside the authenticated layout', () => {
    authState.isAuthenticated = true;
    renderWithRoute('/Home');

    expect(screen.getByRole('heading', { name: /sermonsmith home/i })).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it.each([
    ['/home', /sermonsmith home/i],
    ['/pricing', /choose your plan/i],
    ['/downloads', /scripture downloads/i],
  ])('matches signed-in lowercase public route %s', (route, heading) => {
    authState.isAuthenticated = true;
    renderWithRoute(route);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('reapplies protected metadata after query-only navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/Login']}>
        <RouteMetadata />
        <MetadataNavigationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.title).toBe('SermonSmith Application'));
    fireEvent.click(screen.getByRole('button', { name: /add register query/i }));

    await waitFor(() => {
      expect(screen.getByTestId('metadata-location')).toHaveTextContent('/Login?mode=register');
      expect(document.title).toBe('SermonSmith Application');
    });
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe(
      'noindex,nofollow,noarchive',
    );
  });

  it('clears public share images on protected navigation and restores them on return', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteMetadata />
        <MetadataNavigationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.head.querySelector('meta[property="og:image"]')?.content).toBe(
        'https://sermonsmith.axiombiolabs.org/icon.png',
      );
      expect(document.head.querySelector('meta[name="twitter:image"]')?.content).toBe(
        'https://sermonsmith.axiombiolabs.org/icon.png',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /open protected route/i }));
    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')?.content).toBe(
        'noindex,nofollow,noarchive',
      );
      expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
      expect(document.head.querySelector('meta[property="og:image:alt"]')).toBeNull();
      expect(document.head.querySelector('meta[name="twitter:image"]')).toBeNull();
      expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /return home/i }));
    await waitFor(() => {
      expect(document.head.querySelector('meta[property="og:image"]')?.content).toBe(
        'https://sermonsmith.axiombiolabs.org/icon.png',
      );
      expect(document.head.querySelector('meta[name="twitter:image"]')?.content).toBe(
        'https://sermonsmith.axiombiolabs.org/icon.png',
      );
      expect(document.head.querySelector('link[rel="canonical"]')?.href).toBe(
        'https://sermonsmith.axiombiolabs.org/',
      );
    });
  });

  it('publishes metadata only for intentionally crawlable routes', () => {
    expect(metadataForPath('/Pricing')).toMatchObject({
      path: '/Pricing',
      title: expect.stringContaining('Pricing'),
    });
    expect(metadataForPath('/privacy')).toMatchObject({
      path: '/privacy',
      title: expect.stringContaining('Privacy'),
    });
    expect(metadataForPath('/Reader')).toBeNull();
    expect(metadataForPath('/Login')).toBeNull();
  });
});
