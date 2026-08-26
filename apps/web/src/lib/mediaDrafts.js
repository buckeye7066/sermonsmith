function baseName(fileName) {
  return String(fileName || 'Imported message').replace(/\.[^.]+$/, '').trim() || 'Imported message';
}

export const SERMON_CONCLUSION_MAX_CHARACTERS = 20_000;

export function mediaJobToSermonDraft(job, clipId = null) {
  if (!job || job.status !== 'completed' || !job.transcript) {
    throw new Error('A completed transcript is required');
  }
  const selected = clipId
    ? job.clip_drafts?.find((clip) => clip.id === clipId)
    : null;
  const drafts = selected ? [selected] : (job.clip_drafts || []);
  const transcript = selected?.excerpt || job.transcript;
  const fullTranscriptLength = job.transcript.length;
  return {
    title: selected?.title || baseName(job.file_name),
    topic: 'Imported message',
    big_idea: transcript.slice(0, 500),
    points: drafts.map((clip) => ({
      title: clip.title,
      exegesis: clip.excerpt,
      source_timing: clip.timing_status === 'provider_timestamps'
        ? { start_seconds: clip.start_seconds, end_seconds: clip.end_seconds }
        : null,
    })),
    // The complete transcript remains available through source_media_job_id.
    // A sermon conclusion has a deliberate 20k schema bound, so create a
    // valid draft for long recordings instead of letting the API reject it.
    conclusion: selected ? '' : job.transcript.slice(0, SERMON_CONCLUSION_MAX_CHARACTERS),
    source_media_job_id: job.id,
    source_transcript_character_count: fullTranscriptLength,
    source_transcript_truncated: !selected && fullTranscriptLength > SERMON_CONCLUSION_MAX_CHARACTERS,
    status: 'draft',
  };
}
