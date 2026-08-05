// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoadingAuth: false,
    checkAppState: vi.fn(),
  }),
}));

vi.mock('@/api/apiClient', () => ({
  api: {
    auth: { redirectToLogin: vi.fn() },
  },
}));

vi.mock('../components/admin/UserActivityLogger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('@/components/reader/VerseOfTheDay', () => ({
  default: () => null,
}));

vi.mock('@/components/profile/OnboardingWizard', () => ({
  default: () => null,
}));

vi.mock('@/lib/appStats', () => ({
  WORLDVIEWS_LABEL: 'multiple',
}));

import Home from './Home.jsx';

describe('public Home', () => {
  it('renders the real marketing page without an undefined feature icon', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'SermonSmith' })).toBeInTheDocument();
    expect(screen.getByText('Built for Pastoral Review')).toBeInTheDocument();
    expect(
      screen.getByText('Elapsed-time presentation coaching; no microphone used'),
    ).toBeInTheDocument();
  });
});
