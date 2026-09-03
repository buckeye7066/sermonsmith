// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/apiClient', () => ({
  api: {
    community: {
      groupMeetings: vi.fn(),
      createGroupMeeting: vi.fn(),
      updateGroupMeeting: vi.fn(),
      deleteGroupMeeting: vi.fn(),
      rsvpGroupMeeting: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { api } from '@/api/apiClient';
import MeetingScheduler from './MeetingScheduler';

const meeting = {
  id: 'meeting-1',
  title: 'Romans 8',
  description: 'Life in the Spirit',
  meeting_type: 'virtual',
  scheduled_date: '2099-09-10T23:00:00.000Z',
  duration_minutes: 60,
  location: 'https://meet.example.test/romans',
  discussion_leader_id: 'user-1',
  discussion_leader_name: 'Owner',
  study_passage: 'Romans 8:1-17',
  status: 'scheduled',
};

describe('MeetingScheduler leader controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.community.groupMeetings.mockResolvedValue([meeting]);
    api.community.updateGroupMeeting.mockResolvedValue({ ...meeting, title: 'Romans 8 updated' });
    api.community.deleteGroupMeeting.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lets a leader edit and cancel a scheduled meeting', async () => {
    render(
      <MeetingScheduler
        group={{ id: 'group-1' }}
        user={{ id: 'user-1', full_name: 'Owner' }}
        members={[{ id: 'member-1', user_id: 'user-1', user_name: 'Owner', role: 'leader' }]}
        isLeader
      />,
    );

    expect(await screen.findByText('Romans 8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Romans 8' }));

    const title = screen.getByDisplayValue('Romans 8');
    fireEvent.change(title, { target: { value: 'Romans 8 updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(api.community.updateGroupMeeting).toHaveBeenCalledWith(
        'group-1',
        'meeting-1',
        expect.objectContaining({
          title: 'Romans 8 updated',
          scheduled_date: expect.stringMatching(/^2099-09-10T23:00:00\.000Z$/),
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Romans 8' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Existing RSVPs'));
    await waitFor(() => {
      expect(api.community.deleteGroupMeeting).toHaveBeenCalledWith('group-1', 'meeting-1');
    });
    expect(screen.queryByText('Romans 8')).not.toBeInTheDocument();
  });

  it('does not expose management controls to regular members', async () => {
    render(
      <MeetingScheduler
        group={{ id: 'group-1' }}
        user={{ id: 'user-2', full_name: 'Member' }}
        members={[]}
      />,
    );

    expect(await screen.findByText('Romans 8')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Romans 8' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Romans 8' })).not.toBeInTheDocument();
  });
});
