import OpenAI, { toFile } from 'openai';

const MAX_TRANSCRIPT_CHARACTERS = 500_000;
const MAX_PROVIDER_SEGMENTS = 10_000;
const MAX_CLIP_DRAFTS = 8;
const MAX_CLIP_TITLE_CHARACTERS = 200;

export class MediaTranscriptionError extends Error {
  constructor(message, { code = 'MEDIA_TRANSCRIPTION_FAILED', status = 502 } = {}) {
    super(message);
    this.name = 'MediaTranscriptionError';
    this.code = code;
    this.status = status;
  }
}

function cleanText(value) {
  return String(value ?? '')
    .split(String.fromCharCode(0)).join('')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function cleanSegment(segment, index) {
  const text = cleanText(segment?.text).slice(0, 5_000);
  const start = Number(segment?.start);
  const end = Number(segment?.end);
  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return null;
  }
  return {
    id: String(segment?.id ?? index + 1),
    start_seconds: Math.round(start * 1000) / 1000,
    end_seconds: Math.round(end * 1000) / 1000,
    text,
  };
}

export function normalizeTranscription(result, fallbackProvider = 'unknown') {
  const raw = typeof result === 'string' ? { text: result } : (result || {});
  const text = cleanText(raw.text);
  if (!text) {
    throw new MediaTranscriptionError('The provider returned an empty transcript.', {
      code: 'EMPTY_TRANSCRIPT',
    });
  }
  if (text.length > MAX_TRANSCRIPT_CHARACTERS) {
    throw new MediaTranscriptionError('The transcript exceeds the supported size.', {
      code: 'TRANSCRIPT_TOO_LARGE',
      status: 413,
    });
  }
  const segments = Array.isArray(raw.segments)
    ? raw.segments.slice(0, MAX_PROVIDER_SEGMENTS).map(cleanSegment).filter(Boolean)
    : [];
  const duration = Number(raw.duration_seconds ?? raw.duration);
  return {
    text,
    segments,
    language: cleanText(raw.language).slice(0, 40) || null,
    duration_seconds: Number.isFinite(duration) && duration >= 0
      ? Math.round(duration * 1000) / 1000
      : (segments.at(-1)?.end_seconds ?? null),
    provider: cleanText(raw.provider || fallbackProvider).slice(0, 80) || fallbackProvider,
  };
}

function clipTitle(text, index) {
  const words = cleanText(text).split(/\s+/).slice(0, 8).join(' ');
  const title = words ? `${words}${cleanText(text).split(/\s+/).length > 8 ? '…' : ''}` : `Clip ${index + 1}`;
  return title.slice(0, MAX_CLIP_TITLE_CHARACTERS);
}

/**
 * Produce editable clip proposals. Timed proposals are emitted only when the
 * transcription provider supplied timestamps; plain-text uploads never invent
 * media timing.
 */
export function draftClipSegments(transcription) {
  const normalized = normalizeTranscription(transcription, transcription?.provider);
  if (normalized.segments.length > 0) {
    const drafts = [];
    let cursor = 0;
    while (cursor < normalized.segments.length && drafts.length < MAX_CLIP_DRAFTS) {
      const group = [normalized.segments[cursor]];
      cursor += 1;
      while (
        cursor < normalized.segments.length
        && group.at(-1).end_seconds - group[0].start_seconds < 25
        && normalized.segments[cursor].end_seconds - group[0].start_seconds <= 90
      ) {
        group.push(normalized.segments[cursor]);
        cursor += 1;
      }
      const excerpt = group.map((segment) => segment.text).join(' ').trim();
      drafts.push({
        id: `clip-${drafts.length + 1}`,
        title: clipTitle(excerpt, drafts.length),
        excerpt,
        start_seconds: group[0].start_seconds,
        end_seconds: group.at(-1).end_seconds,
        timing_status: 'provider_timestamps',
      });
    }
    return drafts;
  }

  const paragraphs = normalized.text
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(cleanText)
    .filter(Boolean);
  const drafts = [];
  for (let cursor = 0; cursor < paragraphs.length && drafts.length < MAX_CLIP_DRAFTS;) {
    let excerpt = '';
    while (cursor < paragraphs.length && (excerpt.length < 280 || !excerpt)) {
      const next = paragraphs[cursor];
      if (excerpt && excerpt.length + next.length > 700) break;
      excerpt = `${excerpt} ${next}`.trim();
      cursor += 1;
    }
    if (!excerpt) cursor += 1;
    if (excerpt) {
      drafts.push({
        id: `excerpt-${drafts.length + 1}`,
        title: clipTitle(excerpt, drafts.length),
        excerpt,
        start_seconds: null,
        end_seconds: null,
        timing_status: 'transcript_only',
      });
    }
  }
  return drafts;
}

export class PlainTextTranscriptionProvider {
  constructor() {
    this.name = 'plain-text';
  }

  supports({ mimeType }) {
    return ['text/plain', 'text/markdown'].includes(mimeType);
  }

  async transcribe({ buffer }) {
    const text = cleanText(buffer.toString('utf8'));
    if (!text || text.includes('\uFFFD')) {
      throw new MediaTranscriptionError('The text upload could not be decoded safely.', {
        code: 'INVALID_TEXT_UPLOAD',
        status: 400,
      });
    }
    return { text, provider: this.name };
  }
}

export class OpenAiTranscriptionProvider {
  constructor({ apiKey, model = 'whisper-1', client } = {}) {
    this.name = 'openai';
    this.model = model;
    this.client = client || (apiKey ? new OpenAI({ apiKey }) : null);
  }

  supports({ mimeType }) {
    return !mimeType.startsWith('text/') && Boolean(this.client);
  }

  async transcribe({ buffer, fileName, mimeType }) {
    if (!this.client) {
      throw new MediaTranscriptionError('No audio transcription provider is configured.', {
        code: 'MEDIA_PROVIDER_UNAVAILABLE',
        status: 503,
      });
    }
    try {
      const file = await toFile(buffer, fileName, { type: mimeType });
      const response = await this.client.audio.transcriptions.create({
        file,
        model: this.model,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });
      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
        segments: response.segments,
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof MediaTranscriptionError) throw error;
      throw new MediaTranscriptionError('The transcription provider could not process this upload.', {
        code: 'MEDIA_PROVIDER_FAILED',
        status: 502,
      });
    }
  }
}

export class CompositeMediaTranscriptionProvider {
  constructor(providers = []) {
    this.providers = providers;
  }

  async transcribe(input) {
    const provider = this.providers.find((candidate) => candidate.supports(input));
    if (!provider) {
      throw new MediaTranscriptionError('No provider is configured for this media type.', {
        code: 'MEDIA_PROVIDER_UNAVAILABLE',
        status: 503,
      });
    }
    return normalizeTranscription(await provider.transcribe(input), provider.name);
  }
}

export function createDefaultMediaTranscriptionProvider(env = process.env) {
  const providers = [new PlainTextTranscriptionProvider()];
  if (env.OPENAI_API_KEY && env.MEDIA_TRANSCRIPTION_PROVIDER !== 'disabled') {
    providers.push(new OpenAiTranscriptionProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.MEDIA_TRANSCRIPTION_MODEL || 'whisper-1',
    }));
  }
  return new CompositeMediaTranscriptionProvider(providers);
}
