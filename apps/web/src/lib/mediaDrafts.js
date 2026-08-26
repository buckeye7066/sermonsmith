function baseName(fileName) {
  return String(fileName || 'Imported message').replace(/\.[^.]+$/, '').trim() || 'Imported message';
}

export function mediaJobToSermonDraft(job, clipId = null) {
  if (!job || job.status !== 'completed' || !job.transcript) {
    throw new Error('A completed transcript is required');
  }
  const selected = clipId
    ? job.clip_drafts?.find((clip) => clip.id === clipId)
    : null;
  const drafts = selected ? [selected] : (job.clip_drafts || []);
  const transcript = selected?.excerpt || job.transcript;
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
    conclusion: selected ? '' : job.transcript,
    source_media_job_id: job.id,
    status: 'draft',
  };
}
