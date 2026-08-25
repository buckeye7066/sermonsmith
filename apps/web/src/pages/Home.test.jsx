// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.stubGlobal('IntersectionObserver', class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
});

let authState;

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => authState,
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
import { logActivity } from '../components/admin/UserActivityLogger';

describe('public Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = {
      user: null,
      isLoadingAuth: false,
      checkAppState: vi.fn(),
    };
  });

  it('renders the real marketing page without an undefined feature icon', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('heading', { name: 'SermonSmith' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Built for Pastor-Controlled Drafting')).toBeInTheDocument();
    expect(
      screen.getByText('Elapsed-time presentation coaching; no microphone used'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Example Draft' })).toBeInTheDocument();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it('logs a Home view only after AuthContext resolves a signed-in user', () => {
    authState.user = { id: 'user-1', onboarding_completed: true };

    const view = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(logActivity).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith('page_view', { page_name: 'Home' });

    authState = {
      ...authState,
      user: { ...authState.user, full_name: 'Refreshed user object' },
    };
    view.rerender(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(logActivity).toHaveBeenCalledTimes(1);
  });
});
