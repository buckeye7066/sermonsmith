// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

vi.mock('@/api/apiClient', () => ({
  api: {
    community: {
      myForumContent: vi.fn(),
      myRatings: vi.fn(),
      mySharedSeries: vi.fn(),
      myStudyGroups: vi.fn(),
      mySharedSermonPage: vi.fn(),
      mySharedContent: vi.fn(),
      myPublicReadingPlans: vi.fn(),
      myComments: vi.fn(),
      deletePost: vi.fn(),
      deletePostReply: vi.fn(),
      deleteRating: vi.fn(),
      unshareSeries: vi.fn(),
      unshareSermon: vi.fn(),
      withdrawSharedContent: vi.fn(),
      withdrawReadingPlan: vi.fn(),
      deleteComment: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { api } from '@/api/apiClient';
import MyCommunityContent from './MyCommunityContent';

const renderPage = () => render(<MemoryRouter><MyCommunityContent /></MemoryRouter>);

describe('MyCommunityContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.community.myForumContent.mockResolvedValue({ posts: [], replies: [], next_offset: null });
    api.community.myRatings.mockResolvedValue({ ratings: [], next_offset: null });
    api.community.mySharedSeries.mockResolvedValue({ series: [], next_offset: null });
    api.community.myStudyGroups.mockResolvedValue({ groups: [], next_offset: null });
    api.community.mySharedSermonPage.mockResolvedValue({ sermons: [], next_offset: null });
    api.community.mySharedContent.mockResolvedValue({ shared_content: [], next_offset: null });
    api.community.myPublicReadingPlans.mockResolvedValue({ reading_plans: [], next_offset: null });
    api.community.myComments.mockResolvedValue({ comments: [], next_offset: null });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps load failures visible and lets the user retry', async () => {
    api.community.myForumContent
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ posts: [], replies: [], next_offset: null });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/no community memberships or published community content/i)).toBeInTheDocument();
    expect(api.community.myForumContent).toHaveBeenCalledTimes(2);
  });

  it('retracts a post and its replies from the inventory', async () => {
    api.community.myForumContent.mockResolvedValue({
      posts: [{ id: 'post-1', title: 'Prayer requests', content: 'Please pray', status: 'active' }],
      replies: [{ id: 'reply-1', post_id: 'post-1', parent_title: 'Prayer requests', content: 'Praying' }],
      next_offset: null,
    });
    api.community.deletePost.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    expect(await screen.findByText('Please pray')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }));

    await waitFor(() => expect(api.community.deletePost).toHaveBeenCalledWith('post-1'));
    expect(screen.queryByText('Please pray')).not.toBeInTheDocument();
    expect(screen.queryByText('Praying')).not.toBeInTheDocument();
  });

  it('loads every inventory page and exposes every post-expiry lifecycle control', async () => {
    api.community.myForumContent
      .mockResolvedValueOnce({
        posts: [{ id: 'new-post', title: 'New', content: 'Newest page' }],
        replies: [],
        next_offset: 100,
      })
      .mockResolvedValueOnce({
        posts: [{ id: 'old-post', title: 'Old', content: 'Oldest page' }],
        replies: [],
        next_offset: null,
      });
    api.community.myRatings.mockResolvedValue({
      ratings: [{ id: 'rating-1', rating: 4, target_title: 'Grace sermon', target_type: 'sermon' }],
      next_offset: null,
    });
    api.community.mySharedSeries.mockResolvedValue({
      series: [{ id: 'series-1', title: 'Grace series' }],
      next_offset: null,
    });
    api.community.myStudyGroups.mockResolvedValue({
      groups: [{ id: 'group-1', name: 'Pastors group', membership_role: 'leader' }],
      next_offset: null,
    });
    api.community.mySharedSermonPage.mockResolvedValue({
      sermons: [{ id: 'sermon-1', title: 'Shared grace sermon' }],
      next_offset: null,
    });
    api.community.mySharedContent.mockResolvedValue({
      shared_content: [{ id: 'content-1', title: 'Shared study', content_type: 'study' }],
      next_offset: null,
    });
    api.community.myPublicReadingPlans.mockResolvedValue({
      reading_plans: [{ id: 'plan-1', name: 'Grace plan' }],
      next_offset: null,
    });
    api.community.myComments.mockResolvedValue({
      comments: [{ id: 'comment-1', comment: 'Helpful study', target_type: 'reading_plan' }],
      next_offset: null,
    });
    api.community.deleteRating.mockResolvedValue({ deleted: true });
    api.community.unshareSeries.mockResolvedValue(undefined);
    api.community.unshareSermon.mockResolvedValue(undefined);
    api.community.withdrawSharedContent.mockResolvedValue(undefined);
    api.community.withdrawReadingPlan.mockResolvedValue(undefined);
    api.community.deleteComment.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    expect(await screen.findByText('Oldest page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage membership' })).toHaveAttribute('href', '/GroupDetail?id=group-1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete rating' }));
    await waitFor(() => expect(api.community.deleteRating).toHaveBeenCalledWith('rating-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw series' }));
    await waitFor(() => expect(api.community.unshareSeries).toHaveBeenCalledWith('series-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw sermon' }));
    await waitFor(() => expect(api.community.unshareSermon).toHaveBeenCalledWith('sermon-1'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Make private', exact: true })[0]);
    await waitFor(() => expect(api.community.withdrawSharedContent).toHaveBeenCalledWith('content-1'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Make private', exact: true })).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Make private', exact: true }));
    await waitFor(() => expect(api.community.withdrawReadingPlan).toHaveBeenCalledWith('plan-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    await waitFor(() => expect(api.community.deleteComment).toHaveBeenCalledWith('comment-1'));
    expect(api.community.myForumContent).toHaveBeenNthCalledWith(2, { offset: 100, limit: 100 });
  });
});
