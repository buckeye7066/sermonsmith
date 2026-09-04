// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/apiClient', () => ({
  api: {
    community: {
      groupMessages: vi.fn(),
      sendGroupMessage: vi.fn(),
      deleteGroupMessage: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { api } from '@/api/apiClient';
import GroupChat from './GroupChat';

describe('GroupChat message retraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    api.community.groupMessages.mockResolvedValue([{
      id: 'message-1',
      user_id: 'user-1',
      user_name: 'Owner',
      message: 'Sensitive prayer request',
      message_type: 'prayer_request',
      created_date: '2026-09-03T00:00:00.000Z',
    }]);
    api.community.deleteGroupMessage.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows an owner-only delete control and removes the message after confirmation', async () => {
    render(<GroupChat group={{ id: 'group-1' }} user={{ id: 'user-1' }} />);

    expect(await screen.findByText('Sensitive prayer request')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));

    await waitFor(() => {
      expect(api.community.deleteGroupMessage).toHaveBeenCalledWith('group-1', 'message-1');
      expect(screen.queryByText('Sensitive prayer request')).not.toBeInTheDocument();
    });
  });

  it('prevents duplicate retraction requests while deletion is pending', async () => {
    let finishDelete;
    api.community.deleteGroupMessage.mockImplementation(() => new Promise((resolve) => {
      finishDelete = resolve;
    }));
    render(<GroupChat group={{ id: 'group-1' }} user={{ id: 'user-1' }} />);

    const deleteButton = await screen.findByRole('button', { name: 'Delete message' });
    fireEvent.click(deleteButton);

    const pendingButton = await screen.findByRole('button', { name: 'Deleting message' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(api.community.deleteGroupMessage).toHaveBeenCalledTimes(1);

    finishDelete();
    await waitFor(() => expect(screen.queryByText('Sensitive prayer request')).not.toBeInTheDocument());
  });
});
