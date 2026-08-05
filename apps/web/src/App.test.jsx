// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

let authState;

vi.mock('@/lib/AuthContext', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock('./pages.config', () => {
  const Home = () => <h1>SermonSmith Home</h1>;
  const Pricing = () => <h1>Choose Your Plan</h1>;
  const Downloads = () => <h1>Scripture Downloads</h1>;
  const ProtectedPage = () => <div data-testid="protected-page">Protected page</div>;
  const Layout = ({ children }) => <div data-testid="layout">{children}</div>;

  return {
    pagesConfig: {
      mainPage: 'Home',
      Pages: {
        Home,
        Pricing,
        Downloads,
        Reader: ProtectedPage,
        SermonBuilder: ProtectedPage,
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

import { AuthenticatedApp } from './App.jsx';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
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

  it('renders the signed-in Home inside the authenticated layout', () => {
    authState.isAuthenticated = true;
    renderWithRoute('/Home');

    expect(screen.getByRole('heading', { name: /sermonsmith home/i })).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});
