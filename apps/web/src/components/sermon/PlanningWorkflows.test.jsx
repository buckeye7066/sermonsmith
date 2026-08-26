// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaWorkbench from './MediaWorkbench';
import RevisionHistory from './RevisionHistory';
import SermonCalendarPlanner from './SermonCalendarPlanner';
import TemplateLibrary from './TemplateLibrary';

const mocks = vi.hoisted(() => ({
  sermonUpdate: vi.fn(),
  sermonCreate: vi.fn(),
  sermonBulkCreate: vi.fn(),
  revisions: vi.fn(),
  restoreRevision: vi.fn(),
  sermonTemplateList: vi.fn(),
  sermonTemplateCreate: vi.fn(),
  sermonTemplateDelete: vi.fn(),
  seriesTemplateList: vi.fn(),
  seriesTemplateCreate: vi.fn(),
  seriesTemplateDelete: vi.fn(),
  seriesList: vi.fn(),
  seriesCreate: vi.fn(),
  seriesDelete: vi.fn(),
  mediaJobs: vi.fn(),
  mediaUpload: vi.fn(),
  mediaDelete: vi.fn(),
}));

vi.mock('@/api/apiClient', () => ({
  api: {
    entities: {
      Sermon: {
        update: mocks.sermonUpdate,
        create: mocks.sermonCreate,
        bulkCreate: mocks.sermonBulkCreate,
        revisions: mocks.revisions,
        restoreRevision: mocks.restoreRevision,
      },
      SermonTemplate: {
        list: mocks.sermonTemplateList,
        create: mocks.sermonTemplateCreate,
        delete: mocks.sermonTemplateDelete,
      },
      SeriesTemplate: {
        list: mocks.seriesTemplateList,
        create: mocks.seriesTemplateCreate,
        delete: mocks.seriesTemplateDelete,
      },
      SermonSeries: {
        list: mocks.seriesList,
        create: mocks.seriesCreate,
        delete: mocks.seriesDelete,
      },
    },
    media: {
      jobs: mocks.mediaJobs,
      upload: mocks.mediaUpload,
      deleteJob: mocks.mediaDelete,
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('sermon planning workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    mocks.sermonUpdate.mockResolvedValue({});
    mocks.sermonCreate.mockResolvedValue({ id: 'draft-1' });
    mocks.sermonBulkCreate.mockResolvedValue([]);
    mocks.sermonTemplateList.mockResolvedValue([]);
    mocks.seriesTemplateList.mockResolvedValue([]);
    mocks.seriesList.mockResolvedValue([]);
    mocks.mediaJobs.mockResolvedValue([]);
  });

  it('schedules a sermon through the keyboard-accessible date control', async () => {
    const onChanged = vi.fn();
    render(<SermonCalendarPlanner sermons={[{ id: 'sermon-1', title: 'Grace', scheduled_date: null }]} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText('Schedule Grace'), { target: { value: '2026-12-24' } });
    await waitFor(() => expect(mocks.sermonUpdate).toHaveBeenCalledWith('sermon-1', {
      scheduled_date: '2026-12-24T12:00:00.000Z',
    }));
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('loads and restores a revision while keeping the current version recoverable', async () => {
    const revision = {
      id: 'revision-1',
      reason: 'update',
      created_date: '2026-08-25T12:00:00Z',
      snapshot: { title: 'Earlier version' },
    };
    mocks.revisions.mockResolvedValue([revision]);
    mocks.restoreRevision.mockResolvedValue({ id: 'sermon-1', title: 'Earlier version' });
    const onRestored = vi.fn();
    render(<RevisionHistory entityType="Sermon" entityId="sermon-1" onRestored={onRestored} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(mocks.restoreRevision).toHaveBeenCalledWith('sermon-1', 'revision-1'));
    expect(onRestored).toHaveBeenCalledWith({ id: 'sermon-1', title: 'Earlier version' });
  });

  it('saves a reusable template without copying identity or lifecycle state', async () => {
    const source = {
      id: 'sermon-1',
      user_id: 'owner',
      title: 'Source sermon',
      topic: 'Grace',
      status: 'published',
      scheduled_date: '2026-08-25T12:00:00Z',
    };
    mocks.sermonTemplateCreate.mockResolvedValue({ id: 'template-1' });
    render(<TemplateLibrary sermons={[source]} />);
    await waitFor(() => expect(mocks.sermonTemplateList).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Template source'), { target: { value: 'sermon-1' } });
    fireEvent.change(screen.getByPlaceholderText('Template name (optional)'), { target: { value: 'Reusable grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(mocks.sermonTemplateCreate).toHaveBeenCalled());
    expect(mocks.sermonTemplateCreate.mock.calls[0][0]).toEqual({
      name: 'Reusable grace',
      description: 'Grace',
      content: { title: 'Source sermon', topic: 'Grace' },
    });
  });

  it('uploads media and turns its persisted transcript into a private sermon draft', async () => {
    const job = {
      id: 'job-1',
      status: 'completed',
      file_name: 'Sunday.txt',
      transcript: 'A complete transcript.',
      provider: 'fixture',
      clip_drafts: [],
    };
    mocks.mediaUpload.mockResolvedValue(job);
    const { container } = render(<MediaWorkbench />);
    await waitFor(() => expect(mocks.mediaJobs).toHaveBeenCalled());
    const file = new File(['source bytes'], 'Sunday.txt', { type: 'text/plain' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Transcribe and draft clips' }));
    await screen.findByText('A complete transcript.');
    fireEvent.click(screen.getByRole('button', { name: 'Create sermon draft from transcript' }));
    await waitFor(() => expect(mocks.sermonCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Sunday',
      conclusion: 'A complete transcript.',
      source_media_job_id: 'job-1',
      status: 'draft',
    })));
  });
});
