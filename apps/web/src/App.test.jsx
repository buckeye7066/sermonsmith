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
  const ProtectedPage = () => <div data-testid="protected-page">Protected page</div>;
  const Layout = ({ children }) => <div data-testid="layout">{children}</div>;

  return {
    pagesConfig: {
      mainPage: 'Reader',
      Pages: {
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

// Route-gating assertions look for the Login page's "Sign In" heading, which
// the maintenance banner replaces while the upgrade flag is on — pin it off
// here; the banner itself is covered in Login.test.jsx.
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
    </MemoryRouter>
  );
}

describe('AuthenticatedApp route gating', () => {
  beforeEach(() => {
    cleanup();
    authState = {
      isAuthenticated: false,
      isLoadingAuth: false,
      authError: null,
    };
  });

  it('shows only the login route on unauthenticated startup', async () => {
    renderWithRoute('/');

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/Login'));
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
    authState = {
      isAuthenticated: false,
      isLoadingAuth: true,
      authError: null,
    };

    renderWithRoute('/SermonBuilder');

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('renders protected routes only when authenticated', async () => {
    authState = {
      isAuthenticated: true,
      isLoadingAuth: false,
      authError: null,
    };

    renderWithRoute('/SermonBuilder');

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument();
  });
});
