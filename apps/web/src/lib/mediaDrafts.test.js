import { describe, expect, it } from 'vitest';
import { mediaJobToSermonDraft } from './mediaDrafts';

describe('media transcript sermon drafts', () => {
  const job = {
    id: 'job-1',
    status: 'completed',
    file_name: 'Sunday-message.mp3',
    transcript: 'Complete transcript',
    clip_drafts: [{
      id: 'clip-1',
      title: 'Grace changes us',
      excerpt: 'A focused excerpt',
      start_seconds: 10,
      end_seconds: 42,
      timing_status: 'provider_timestamps',
    }],
  };

  it('creates a private sermon draft from a whole transcript', () => {
    expect(mediaJobToSermonDraft(job)).toMatchObject({
      title: 'Sunday-message',
      conclusion: 'Complete transcript',
      source_media_job_id: 'job-1',
      status: 'draft',
    });
  });

  it('creates a focused draft with provider timing evidence', () => {
    expect(mediaJobToSermonDraft(job, 'clip-1')).toMatchObject({
      title: 'Grace changes us',
      big_idea: 'A focused excerpt',
      points: [{ source_timing: { start_seconds: 10, end_seconds: 42 } }],
      status: 'draft',
    });
  });

  it('rejects incomplete jobs', () => {
    expect(() => mediaJobToSermonDraft({ status: 'failed' })).toThrow('completed transcript');
  });
});
