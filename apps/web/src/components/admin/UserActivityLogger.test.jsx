// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/apiClient', () => ({
  api: {
    auth: { me: vi.fn() },
    entities: { UserActivity: { create: vi.fn() } },
  },
}));

import { buildActivityRecord } from './UserActivityLogger.jsx';

describe('buildActivityRecord', () => {
  it('keeps coarse operational fields and drops content and direct identifiers', () => {
    window.history.replaceState({}, '', '/SermonBuilder?reset_token=secret#private-note');

    const record = buildActivityRecord(
      'sermon_saved',
      {
        page_name: 'SermonBuilder',
        resource_type: 'sermon',
        resource_id: 'sermon-secret-id',
        user_email: 'pastor@example.com',
        metadata: { prompt: 'confidential counseling detail' },
        data_modified: 'full sermon content',
        data_viewed: 'private note',
        error_message: 'contained@example.com',
        outcome: 'error',
      },
      new Date('2026-08-05T12:00:00.000Z'),
    );

    expect(record).toEqual({
      action_type: 'sermon_saved',
      page_name: 'SermonBuilder',
      resource_type: 'sermon',
      metadata: {
        timestamp: '2026-08-05T12:00:00.000Z',
        outcome: 'failure',
      },
    });

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('pastor@example.com');
    expect(serialized).not.toContain('confidential');
    expect(serialized).not.toContain('full sermon');
    expect(serialized).not.toContain('private note');
    expect(serialized).not.toContain('reset_token');
  });

  it('bounds caller-controlled labels', () => {
    const record = buildActivityRecord('<script>alert(1)</script>', {
      page_name: 'Reader?verse=private',
      resource_type: 'verse/reference',
    });

    expect(record.action_type).toBe('scriptalert1script');
    expect(record.page_name).toBe('Readerverseprivate');
    expect(record.resource_type).toBe('versereference');
    expect(record.metadata.outcome).toBe('success');
  });
});
