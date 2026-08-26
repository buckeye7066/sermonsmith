import crypto from 'crypto';
import express, { Router } from 'express';
import { authenticateToken, prisma } from '../middleware/auth.js';
import {
  createDefaultMediaTranscriptionProvider,
  draftClipSegments,
  MediaTranscriptionError,
} from '../services/mediaTranscription.js';

export const MEDIA_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
export const SUPPORTED_MEDIA_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
]);

function safeFileName(raw) {
  let decoded = String(raw || 'upload').slice(0, 300);
  try { decoded = decodeURIComponent(decoded); } catch { /* keep raw header */ }
  const base = decoded.split(/[\\/]/).pop() || 'upload';
  return base.replace(/[^A-Za-z0-9._() -]/g, '_').slice(0, 180) || 'upload';
}

function jobResponse(entity) {
  return { id: entity.id, ...entity.data, created_date: entity.createdAt, updated_date: entity.updatedAt };
}

function safeFailure(error) {
  if (error instanceof MediaTranscriptionError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  return {
    code: 'MEDIA_TRANSCRIPTION_FAILED',
    message: 'The upload could not be transcribed.',
    status: 502,
  };
}

function validateContentType(req, res, next) {
  const mimeType = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!SUPPORTED_MEDIA_TYPES.has(mimeType)) {
    return res.status(415).json({
      message: 'Unsupported media type.',
      supported_types: [...SUPPORTED_MEDIA_TYPES],
    });
  }
  req.mediaMimeType = mimeType;
  return next();
}

export function buildMediaRouter({ provider = createDefaultMediaTranscriptionProvider() } = {}) {
  const router = Router();

  router.post(
    '/jobs',
    authenticateToken,
    validateContentType,
    express.raw({ type: () => true, limit: MEDIA_UPLOAD_LIMIT_BYTES }),
    async (req, res, next) => {
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buffer.length === 0) return res.status(400).json({ message: 'The upload is empty.' });

      const fileName = safeFileName(req.get('x-file-name'));
      const createdAt = new Date().toISOString();
      let job;
      try {
        job = await prisma.entity.create({
          data: {
            type: 'MediaJob',
            userId: req.userId,
            data: {
              user_id: req.userId,
              status: 'processing',
              file_name: fileName,
              mime_type: req.mediaMimeType,
              byte_size: buffer.length,
              sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
              created_date: createdAt,
            },
          },
        });

        const transcription = await provider.transcribe({
          buffer,
          fileName,
          mimeType: req.mediaMimeType,
        });
        const data = {
          ...job.data,
          status: 'completed',
          transcript: transcription.text,
          segments: transcription.segments,
          clip_drafts: draftClipSegments(transcription),
          language: transcription.language,
          duration_seconds: transcription.duration_seconds,
          provider: transcription.provider,
          completed_date: new Date().toISOString(),
        };
        const completed = await prisma.entity.update({ where: { id: job.id }, data: { data } });
        return res.status(201).json(jobResponse(completed));
      } catch (error) {
        const failure = safeFailure(error);
        if (job) {
          await prisma.entity.update({
            where: { id: job.id },
            data: {
              data: {
                ...job.data,
                status: 'failed',
                error_code: failure.code,
                error_message: failure.message,
                failed_date: new Date().toISOString(),
              },
            },
          }).catch(() => {});
        }
        if (failure.status >= 500) return res.status(failure.status).json({ message: failure.message, code: failure.code, job_id: job?.id });
        return res.status(failure.status).json({ message: failure.message, code: failure.code, job_id: job?.id });
      }
    },
  );

  router.get('/jobs', authenticateToken, async (req, res, next) => {
    try {
      const jobs = await prisma.entity.findMany({
        where: { type: 'MediaJob', userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return res.json(jobs.map(jobResponse));
    } catch (error) {
      return next(error);
    }
  });

  router.get('/jobs/:id', authenticateToken, async (req, res, next) => {
    try {
      const job = await prisma.entity.findFirst({
        where: { id: req.params.id, type: 'MediaJob', userId: req.userId },
      });
      if (!job) return res.status(404).json({ message: 'Media job not found.' });
      return res.json(jobResponse(job));
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/jobs/:id', authenticateToken, async (req, res, next) => {
    try {
      const job = await prisma.entity.findFirst({
        where: { id: req.params.id, type: 'MediaJob', userId: req.userId },
      });
      if (!job) return res.status(404).json({ message: 'Media job not found.' });
      await prisma.entity.delete({ where: { id: job.id } });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default buildMediaRouter();
