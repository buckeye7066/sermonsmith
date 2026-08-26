import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, FileAudio, FileText, Loader2, Scissors, Trash2, Upload } from 'lucide-react';
import { api } from '@/api/apiClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mediaJobToSermonDraft } from '@/lib/mediaDrafts';
import { toast } from 'sonner';

const ACCEPTED_TYPES = '.txt,.md,.mp3,.mp4,.m4a,.wav,.webm,audio/mpeg,audio/mp4,audio/wav,audio/webm,video/mp4,video/webm,text/plain,text/markdown';

function durationLabel(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function MediaWorkbench({ onDraftCreated }) {
  const [jobs, setJobs] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [detailsLoadingId, setDetailsLoadingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => setJobs(await api.media.jobs()), []);

  useEffect(() => {
    load().catch((loadError) => {
      console.error('Unable to load media jobs:', loadError);
      setError('Media jobs could not be loaded.');
    });
  }, [load]);

  const loadDetails = async (job) => {
    if (job.status !== 'completed' || job.transcript) return job;
    setDetailsLoadingId(job.id);
    try {
      const details = await api.media.job(job.id);
      setJobs((current) => current.map((candidate) => candidate.id === details.id ? details : candidate));
      return details;
    } finally {
      setDetailsLoadingId('');
    }
  };

  const upload = async () => {
    if (!file) return toast.error('Choose a supported transcript, audio, or video file');
    setUploading(true);
    setError('');
    try {
      const job = await api.media.upload(file);
      setJobs((current) => [job, ...current.filter((candidate) => candidate.id !== job.id)]);
      setFile(null);
      toast.success('Transcript and clip drafts created');
    } catch (uploadError) {
      console.error('Unable to process media:', uploadError);
      if (uploadError.data?.code === 'MEDIA_PROVIDER_UNAVAILABLE') {
        setError('Audio and video transcription needs a configured provider. Plain-text transcripts work without external credentials.');
      } else {
        setError(uploadError.message || 'The upload could not be processed.');
      }
      await load().catch(() => {});
    } finally {
      setUploading(false);
    }
  };

  const createDraft = async (job, clipId = null) => {
    setBusyId(`${job.id}:${clipId || 'all'}`);
    try {
      const details = await loadDetails(job);
      await api.entities.Sermon.create(mediaJobToSermonDraft(details, clipId));
      await onDraftCreated?.();
      toast.success(clipId ? 'Clip sermon draft created' : 'Transcript sermon draft created');
    } catch (draftError) {
      console.error('Unable to create sermon draft:', draftError);
      toast.error('Unable to create a sermon draft');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (job) => {
    if (!confirm(`Delete the saved transcript for “${job.file_name}”?`)) return;
    setBusyId(job.id);
    try {
      await api.media.deleteJob(job.id);
      setJobs((current) => current.filter((candidate) => candidate.id !== job.id));
      toast.success('Media job deleted');
    } catch (deleteError) {
      console.error('Unable to delete media job:', deleteError);
      toast.error('Unable to delete the media job');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Media to ministry drafts</CardTitle>
          <p className="text-sm text-gray-500">Upload a transcript, audio, or video file. Source bytes are used for transcription and discarded; the transcript and editable clip proposals are saved to your account.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="min-w-0 flex-1 rounded border p-2"
          />
          <Button onClick={upload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileAudio className="mr-2 h-4 w-4" />}
            Transcribe and draft clips
          </Button>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {jobs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">No saved media transcripts yet.</CardContent></Card>
      ) : jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" />{job.file_name}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={job.status === 'completed' ? 'secondary' : 'destructive'}>{job.status}</Badge>
                  {job.provider && <Badge variant="outline">{job.provider}</Badge>}
                  {durationLabel(job.duration_seconds) && <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" />{durationLabel(job.duration_seconds)}</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(job)} disabled={Boolean(busyId)} aria-label={`Delete ${job.file_name}`}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.status === 'failed' && <Alert variant="destructive"><AlertDescription>{job.error_message}</AlertDescription></Alert>}
            {job.status === 'completed' && (
              <>
                <details
                  className="rounded border p-3"
                  onToggle={(event) => {
                    if (!event.currentTarget.open || job.transcript) return;
                    loadDetails(job).catch((detailsError) => {
                      console.error('Unable to load media-job details:', detailsError);
                      setError('The complete transcript could not be loaded.');
                    });
                  }}
                >
                  <summary className="cursor-pointer font-medium">Transcript</summary>
                  {detailsLoadingId === job.id
                    ? <p className="mt-3 text-sm text-gray-500">Loading transcript…</p>
                    : job.transcript
                      ? <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{job.transcript}</p>
                      : <p className="mt-3 text-sm text-gray-500">Open this section to load the complete transcript.</p>}
                </details>
                <Button variant="outline" onClick={() => createDraft(job)} disabled={Boolean(busyId)}>
                  {busyId === `${job.id}:all` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create sermon draft from transcript
                </Button>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 font-semibold"><Scissors className="h-4 w-4" /> Clip drafts ({job.clip_drafts?.length ?? job.clip_draft_count ?? 0})</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(job.clip_drafts || []).map((clip) => (
                      <div key={clip.id} className="rounded border p-3">
                        <p className="font-medium">{clip.title}</p>
                        <p className="mt-1 line-clamp-4 text-sm text-gray-600 dark:text-gray-300">{clip.excerpt}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {clip.timing_status === 'provider_timestamps'
                            ? `${durationLabel(clip.start_seconds)}–${durationLabel(clip.end_seconds)}`
                            : 'Transcript excerpt · timing not supplied'}
                        </p>
                        <Button className="mt-3" size="sm" onClick={() => createDraft(job, clip.id)} disabled={Boolean(busyId)}>
                          {busyId === `${job.id}:${clip.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create clip sermon draft
                        </Button>
                      </div>
                    ))}
                    {!job.clip_drafts && (job.clip_draft_count || 0) > 0 && (
                      <p className="text-sm text-gray-500">Open the transcript to load its clip drafts.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
