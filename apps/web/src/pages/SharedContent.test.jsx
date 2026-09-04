// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/apiClient', () => ({
  api: {
    auth: { redirectToLogin: vi.fn() },
    community: {
      sharedContent: vi.fn(),
      share: vi.fn(),
      like: vi.fn(),
      save: vi.fn(),
    },
    entities: {
      SharedContent: { filter: vi.fn() },
    },
  },
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'free-user' }, isLoadingAuth: false }),
}));

vi.mock('@/components/hooks/usePremiumAccess', () => ({
  usePremiumAccess: () => ({
    hasEntitlement: () => false,
    loading: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { api } from '@/api/apiClient';
import SharedContent, { pointPreviewText, shareLinkSlugFromLocation } from './SharedContent';

describe('SharedContent personal library access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.entities.SharedContent.filter.mockResolvedValue([{
      id: 'private-note',
      title: 'Private study note',
      content: 'Owner-only content',
      content_type: 'note',
      visibility: 'private',
      created_date: '2026-09-03T00:00:00.000Z',
    }]);
  });

  afterEach(() => cleanup());

  it('loads the owner-scoped private tab without requesting the Premium public feed', async () => {
    render(<SharedContent />);

    expect(await screen.findByText('Private study note')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Shared Content' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText(/community discovery requires premium/i)).toBeInTheDocument();
    expect(api.entities.SharedContent.filter).toHaveBeenCalledWith({}, '-created_date', 50);
    await waitFor(() => expect(api.community.sharedContent).not.toHaveBeenCalled());
    expect(screen.queryByRole('tab', { name: 'Popular' })).not.toBeInTheDocument();
  });
});

describe('SharedContent share-link route contract', () => {
  it('reads share links from the desktop hash-router query before the page query', () => {
    expect(shareLinkSlugFromLocation({
      search: '?link=stale-page-slug',
      hash: '#/SharedContent?link=desktop-hash-slug',
    })).toBe('desktop-hash-slug');
  });

  it('renders canonical sermon point fields without treating structured values as text', () => {
    expect(pointPreviewText({ exegesis: 'Explain the passage', illustration: { unsafe: true } })).toBe('Explain the passage');
    expect(pointPreviewText({ illustration: { unsafe: true }, application: 'Apply it this week.' })).toBe('Apply it this week.');
  });
});
