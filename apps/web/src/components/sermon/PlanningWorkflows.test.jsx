// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MediaWorkbench from './MediaWorkbench';
import RevisionHistory from './RevisionHistory';
import SermonCalendarPlanner from './SermonCalendarPlanner';
import TemplateLibrary from './TemplateLibrary';

const mocks = vi.hoisted(() => ({
  sermonUpdate: vi.fn(),
  sermonCreate: vi.fn(),
  sermonFilter: vi.fn(),
  sermonBulkCreate: vi.fn(),
  revisions: vi.fn(),
  restoreRevision: vi.fn(),
  sermonTemplateList: vi.fn(),
  sermonTemplateCreate: vi.fn(),
  sermonTemplateDelete: vi.fn(),
  seriesTemplateList: vi.fn(),
  seriesTemplateCreate: vi.fn(),
  seriesTemplateDelete: vi.fn(),
  seriesTemplateInstantiate: vi.fn(),
  seriesList: vi.fn(),
  mediaJobs: vi.fn(),
  mediaJob: vi.fn(),
  mediaUpload: vi.fn(),
  mediaDelete: vi.fn(),
}));

vi.mock('@/api/apiClient', () => ({
  api: {
    entities: {
      Sermon: {
        update: mocks.sermonUpdate,
        create: mocks.sermonCreate,
        filter: mocks.sermonFilter,
        bulkCreate: mocks.sermonBulkCreate,
        revisions: mocks.revisions,
        restoreRevision: mocks.restoreRevision,
      },
      SermonTemplate: {
        filter: mocks.sermonTemplateList,
        create: mocks.sermonTemplateCreate,
        delete: mocks.sermonTemplateDelete,
      },
      SeriesTemplate: {
        filter: mocks.seriesTemplateList,
        create: mocks.seriesTemplateCreate,
        delete: mocks.seriesTemplateDelete,
        instantiate: mocks.seriesTemplateInstantiate,
      },
      SermonSeries: {
        filter: mocks.seriesList,
      },
    },
    media: {
      jobs: mocks.mediaJobs,
      job: mocks.mediaJob,
      upload: mocks.mediaUpload,
      deleteJob: mocks.mediaDelete,
    },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('sermon planning workflows', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal('confirm', vi.fn(() => true));
    mocks.sermonUpdate.mockResolvedValue({});
    mocks.sermonCreate.mockResolvedValue({ id: 'draft-1' });
    mocks.sermonFilter.mockResolvedValue([]);
    mocks.sermonBulkCreate.mockResolvedValue([]);
    mocks.sermonTemplateList.mockResolvedValue([]);
    mocks.seriesTemplateList.mockResolvedValue([]);
    mocks.seriesList.mockResolvedValue([]);
    mocks.mediaJobs.mockResolvedValue([]);
    mocks.seriesTemplateInstantiate.mockResolvedValue({ series: { id: 'new-series' }, sermons: [] });
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
    expect(mocks.revisions).toHaveBeenCalledWith('sermon-1', 100, 0);
    await waitFor(() => expect(mocks.restoreRevision).toHaveBeenCalledWith('sermon-1', 'revision-1'));
    expect(onRestored).toHaveBeenCalledWith({ id: 'sermon-1', title: 'Earlier version' });
  });

  it('loads revision pages beyond the first hundred versions', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `revision-${index}`,
      created_date: `2026-08-25T12:${String(index % 60).padStart(2, '0')}:00Z`,
      snapshot: { title: `Version ${index}` },
    }));
    mocks.revisions
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{
        id: 'revision-older',
        created_date: '2025-08-25T12:00:00Z',
        snapshot: { title: 'Oldest reachable version' },
      }]);

    render(<RevisionHistory entityType="Sermon" entityId="sermon-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load older versions' }));

    await screen.findByText(/Oldest reachable version/u);
    expect(mocks.revisions).toHaveBeenNthCalledWith(1, 'sermon-1', 100, 0);
    expect(mocks.revisions).toHaveBeenNthCalledWith(2, 'sermon-1', 100, 100);
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
    render(<TemplateLibrary sermons={[source]} userId="owner" />);
    await waitFor(() => expect(mocks.sermonTemplateList).toHaveBeenCalledWith(
      { user_id: 'owner' },
      '-created_date',
      200,
    ));
    expect(mocks.seriesTemplateList).toHaveBeenCalledWith({ user_id: 'owner' }, '-created_date', 200);
    expect(mocks.seriesList).toHaveBeenCalledWith({ user_id: 'owner' }, '-created_date', 200);
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

  it('loads full transcript details only when a summary job is used', async () => {
    const summary = {
      id: 'job-summary',
      status: 'completed',
      file_name: 'Sunday.mp3',
      provider: 'fixture',
      transcript_character_count: 22,
      clip_draft_count: 0,
    };
    const details = {
      ...summary,
      transcript: 'Lazy loaded transcript.',
      clip_drafts: [],
    };
    mocks.mediaJobs.mockResolvedValue([summary]);
    mocks.mediaJob.mockResolvedValue(details);

    render(<MediaWorkbench />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create sermon draft from transcript' }));

    await waitFor(() => expect(mocks.mediaJob).toHaveBeenCalledWith('job-summary'));
    expect(mocks.sermonCreate).toHaveBeenCalledWith(expect.objectContaining({
      source_media_job_id: 'job-summary',
      conclusion: 'Lazy loaded transcript.',
    }));
  });

  it('uses one idempotent server request to create a complete series draft', async () => {
    mocks.seriesTemplateList.mockResolvedValue([{
      id: 'series-template-1',
      name: 'Reusable series',
      content: {
        title: 'New series',
        sermon_blueprints: [{ title: 'Week one' }],
      },
    }]);
    render(<TemplateLibrary sermons={[]} userId="owner" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create drafts' }));

    await waitFor(() => expect(mocks.seriesTemplateInstantiate).toHaveBeenCalledWith(
      'series-template-1',
      expect.stringMatching(/^[0-9a-f-]{36}$/iu),
    ));
  });

  it('reuses the same idempotency key when a manual retry follows an ambiguous response loss', async () => {
    const template = {
      id: 'series-template-retry',
      name: 'Retry-safe series',
      content: { title: 'Retry-safe series', sermon_blueprints: [] },
    };
    mocks.seriesTemplateList.mockResolvedValue([template]);
    mocks.seriesTemplateInstantiate
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce({ series: { id: 'new-series' }, sermons: [] });

    const first = render(<TemplateLibrary sermons={[]} userId="owner" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create drafts' }));
    await waitFor(() => expect(mocks.seriesTemplateInstantiate).toHaveBeenCalledTimes(1));
    const firstRequestId = mocks.seriesTemplateInstantiate.mock.calls[0][1];
    first.unmount();

    render(<TemplateLibrary sermons={[]} userId="owner" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create drafts' }));
    await waitFor(() => expect(mocks.seriesTemplateInstantiate).toHaveBeenCalledTimes(2));
    expect(mocks.seriesTemplateInstantiate.mock.calls[1][1]).toBe(firstRequestId);
  });

  it('fetches every selected series member instead of copying only the parent page', async () => {
    mocks.seriesList.mockResolvedValue([{
      id: 'series-source',
      title: 'Source series',
      description: 'All weeks',
      length: 1,
    }]);
    mocks.sermonFilter.mockResolvedValue([{
      id: 'sermon-outside-parent-page',
      title: 'Hidden week',
      series_id: 'series-source',
      series_order: 1,
    }]);
    mocks.seriesTemplateCreate.mockResolvedValue({ id: 'template-created' });

    const { container } = render(<TemplateLibrary sermons={[]} userId="owner" />);
    fireEvent.change(container.querySelector('select'), { target: { value: 'series' } });
    fireEvent.change(await screen.findByLabelText('Template source'), { target: { value: 'series-source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => expect(mocks.sermonFilter).toHaveBeenCalledWith(
      { user_id: 'owner', series_id: 'series-source' },
      '-created_date',
      53,
    ));
    expect(mocks.seriesTemplateCreate).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({
        sermon_blueprints: [expect.objectContaining({ title: 'Hidden week' })],
      }),
    }));
  });

  it('does not remove completed template content when only the refresh callback fails', async () => {
    mocks.seriesTemplateList.mockResolvedValue([{
      id: 'series-template-2',
      name: 'Completed series',
      content: {
        title: 'Completed series',
        sermon_blueprints: [{ title: 'Week one' }],
      },
    }]);
    render(<TemplateLibrary sermons={[]} userId="owner" onCreated={() => Promise.reject(new Error('refresh failed'))} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create drafts' }));

    await waitFor(() => expect(mocks.seriesTemplateInstantiate).toHaveBeenCalledOnce());
  });
});
