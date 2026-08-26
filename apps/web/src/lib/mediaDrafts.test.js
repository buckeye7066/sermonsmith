import { describe, expect, it } from 'vitest';
import { mediaJobToSermonDraft, SERMON_CONCLUSION_MAX_CHARACTERS } from './mediaDrafts';

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

  it('keeps a long transcript draft within the sermon schema and links the complete source job', () => {
    const transcript = 'a'.repeat(SERMON_CONCLUSION_MAX_CHARACTERS + 137);
    const draft = mediaJobToSermonDraft({ ...job, transcript });

    expect(draft.conclusion).toHaveLength(SERMON_CONCLUSION_MAX_CHARACTERS);
    expect(draft.source_media_job_id).toBe(job.id);
    expect(draft.source_transcript_character_count).toBe(transcript.length);
    expect(draft.source_transcript_truncated).toBe(true);
  });

  it('rejects incomplete jobs', () => {
    expect(() => mediaJobToSermonDraft({ status: 'failed' })).toThrow('completed transcript');
  });
});
