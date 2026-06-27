// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const login = vi.fn();
const register = vi.fn();
const forgotPassword = vi.fn();
const resetPassword = vi.fn();

vi.mock('@/api/apiClient', () => ({
  api: {
    auth: {
      login: (...args) => login(...args),
      register: (...args) => register(...args),
      forgotPassword: (...args) => forgotPassword(...args),
      resetPassword: (...args) => resetPassword(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

  it('preserves reset-token mode while scrubbing the token from the URL', async () => {
    renderLogin('/Login?reset_token=secret-token');

    expect(await screen.findByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/Login'));
  });

  it('normalizes same-origin hash-router returns to router paths', () => {
    expect(getSafeReturnUrl(`${window.location.origin}/#/SermonBuilder`)).toBe('/SermonBuilder');
  });
});
