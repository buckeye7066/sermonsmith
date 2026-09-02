// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/apiClient', () => ({
  api: {
    community: {
      myForumContent: vi.fn(),
      deletePost: vi.fn(),
      deletePostReply: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { api } from '@/api/apiClient';
import MyCommunityContent from './MyCommunityContent';

describe('MyCommunityContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps load failures visible and lets the user retry', async () => {
    api.community.myForumContent
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ posts: [], replies: [] });

    render(<MyCommunityContent />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/have not published any forum posts or replies/i)).toBeInTheDocument();
    expect(api.community.myForumContent).toHaveBeenCalledTimes(2);
  });

  it('retracts a post and its replies from the inventory', async () => {
    api.community.myForumContent.mockResolvedValue({
      posts: [{ id: 'post-1', title: 'Prayer requests', content: 'Please pray', status: 'active' }],
      replies: [{ id: 'reply-1', post_id: 'post-1', parent_title: 'Prayer requests', content: 'Praying' }],
    });
    api.community.deletePost.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MyCommunityContent />);
    expect(await screen.findByText('Please pray')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));

    await waitFor(() => expect(api.community.deletePost).toHaveBeenCalledWith('post-1'));
    expect(screen.queryByText('Please pray')).not.toBeInTheDocument();
    expect(screen.queryByText('Praying')).not.toBeInTheDocument();
  });
});
