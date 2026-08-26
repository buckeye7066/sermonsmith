import { describe, expect, it, vi } from 'vitest';
import {
  CompositeMediaTranscriptionProvider,
  draftClipSegments,
  MediaTranscriptionError,
  normalizeTranscription,
  PlainTextTranscriptionProvider,
} from '../services/mediaTranscription.js';

describe('media transcription providers', () => {
  it('transcribes a local text upload without external credentials', async () => {
    const provider = new PlainTextTranscriptionProvider();
    const result = await provider.transcribe({
      buffer: Buffer.from('First paragraph.\n\nSecond paragraph.'),
      mimeType: 'text/plain',
    });
    expect(result).toMatchObject({ provider: 'plain-text', text: 'First paragraph.\n\nSecond paragraph.' });
  });

  it('selects the first compatible provider and normalizes its result', async () => {
    const transcribe = vi.fn(async () => ({ text: 'Provider text', provider: 'fixture' }));
    const provider = new CompositeMediaTranscriptionProvider([
      { supports: ({ mimeType }) => mimeType === 'audio/mpeg', transcribe },
    ]);
    const result = await provider.transcribe({ mimeType: 'audio/mpeg', buffer: Buffer.from('fixture') });
    expect(result.text).toBe('Provider text');
    expect(transcribe).toHaveBeenCalledOnce();
  });

  it('returns an explicit configuration boundary when no provider supports the media', async () => {
    const provider = new CompositeMediaTranscriptionProvider([]);
    await expect(provider.transcribe({ mimeType: 'audio/mpeg' })).rejects.toMatchObject({
      code: 'MEDIA_PROVIDER_UNAVAILABLE',
      status: 503,
    });
  });

  it('uses provider timestamps for timed clip drafts', () => {
    const persisted = normalizeTranscription({
      text: 'Opening thought. Main idea.',
      provider: 'fixture',
      segments: [
        { id: 1, start: 4.2, end: 15.1, text: 'Opening thought.' },
        { id: 2, start: 15.1, end: 31.5, text: 'Main idea.' },
      ],
    });
    const clips = draftClipSegments(persisted);
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({
      start_seconds: 4.2,
      end_seconds: 31.5,
      timing_status: 'provider_timestamps',
    });
  });

  it('does not invent timestamps for transcript-only clip drafts', () => {
    const clips = draftClipSegments({
      text: 'A complete opening paragraph. A second sentence adds enough context for an editable excerpt.',
      provider: 'plain-text',
    });
    expect(clips[0]).toMatchObject({
      start_seconds: null,
      end_seconds: null,
      timing_status: 'transcript_only',
    });
  });

  it('keeps generated clip titles inside the Sermon title schema bound', () => {
    const clips = draftClipSegments({
      text: `${'x'.repeat(350)}. A second sentence makes a complete excerpt.`,
      provider: 'plain-text',
    });
    expect(clips[0].title.length).toBeLessThanOrEqual(200);
  });

  it('rejects empty provider output', () => {
    expect(() => normalizeTranscription({ text: '  ' })).toThrow(MediaTranscriptionError);
  });
});
