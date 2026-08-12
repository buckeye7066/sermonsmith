// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

const login = vi.fn();
const register = vi.fn();
const forgotPassword = vi.fn();
const resetPassword = vi.fn();
// Runtime maintenance probe (GET /api/auth/maintenance). Default: never
// resolves, so tests of the static states see no mid-test flip; the runtime
// toggle tests override it per-test with mockResolvedValueOnce.
const maintenanceProbe = vi.fn(() => new Promise(() => {}));

vi.mock('@/api/apiClient', () => ({
  api: {
    auth: {
      login: (...args) => login(...args),
      register: (...args) => register(...args),
      forgotPassword: (...args) => forgotPassword(...args),
      resetPassword: (...args) => resetPassword(...args),
      maintenance: (...args) => maintenanceProbe(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Login calls useAuth() for checkAppState; the test renders it without an
// AuthProvider, so stub the hook (otherwise useAuth throws "must be used
// within an AuthProvider"). The routing assertions don't depend on real auth.
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ checkAppState: vi.fn() }),
}));

// These tests exercise the normal (non-maintenance) login flows; the
// maintenance banner has its own test below using the real module shape.
const maintenanceState = { active: false };
vi.mock('@/lib/maintenance', () => ({
  LOGIN_MAINTENANCE: {
    get active() {
      return maintenanceState.active;
    },
    title: 'SermonSmith is being upgraded',
    message: 'Upgrade in progress.',
    etaText: 'Expected back online soon.',
  },
}));

import Login, { getSafeReturnUrl } from './Login.jsx';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

function renderLogin(route = '/Login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LocationProbe />
      <Login />
    </MemoryRouter>
  );
}

describe('Login routing', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    login.mockResolvedValue({ id: 'u1' });
  });

  it('returns a successful login to the intended same-app route', async () => {
    const { container } = renderLogin('/Login?return=%2FSermonBuilder%3Fdraft%3D1');

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: 'pastor@example.com' },
    });
    fireEvent.change(container.querySelector('input[type="password"]'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('pastor@example.com', 'correct horse battery staple'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/SermonBuilder?draft=1'));
  });

  it('falls back to the app root for an off-origin return URL', async () => {
    const { container } = renderLogin(`/Login?return=${encodeURIComponent('https://evil.example/pwn')}`);

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: 'pastor@example.com' },
    });
    fireEvent.change(container.querySelector('input[type="password"]'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
  });

  it('opens registration from a stable public mode URL', async () => {
    renderLogin('/Login?mode=register');

    expect(await screen.findByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/Login?mode=register');
  });

  it('opens password recovery from a stable public mode URL', async () => {
    renderLogin('/Login?mode=forgot');

    expect(await screen.findByRole('heading', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('preserves reset-token mode while scrubbing the token from the URL', async () => {
    renderLogin('/Login?reset_token=secret-token');

    expect(await screen.findByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/Login'));
  });

  it('normalizes same-origin hash-router returns to router paths', () => {
    expect(getSafeReturnUrl(`${window.location.origin}/#/SermonBuilder`)).toBe('/SermonBuilder');
  });
});

describe('Login maintenance mode', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('replaces the sign-in form with the upgrade banner and blocks login', () => {
    maintenanceState.active = true;
    try {
      renderLogin();

      expect(screen.getByRole('status')).toHaveTextContent(/being upgraded/i);
      expect(screen.getByRole('status')).toHaveTextContent(/back online/i);
      // No form fields, no submit — nothing to log in with.
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
      expect(login).not.toHaveBeenCalled();
    } finally {
      maintenanceState.active = false;
    }
  });

  it('follows the server toggle OFF: static banner yields to the live form', async () => {
    maintenanceState.active = true;
    try {
      maintenanceProbe.mockResolvedValueOnce({ active: false });
      renderLogin();

      // Static fallback shows the banner first…
      expect(screen.getByRole('status')).toHaveTextContent(/being upgraded/i);
      // …then the server's answer (maintenance off) restores the form.
      await waitFor(() =>
        expect(screen.queryByRole('status')).not.toBeInTheDocument(),
      );
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    } finally {
      maintenanceState.active = false;
    }
  });

  it('follows the server toggle ON: banner appears even when the bundle says off', async () => {
    maintenanceProbe.mockResolvedValueOnce({
      active: true,
      title: 'SermonSmith is being upgraded',
      message: 'Upgrade in progress.',
      etaText: 'Expected back online soon.',
    });
    renderLogin();

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/being upgraded/i),
    );
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
});
