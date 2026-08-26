import { describe, expect, it } from 'vitest';
import {
  sermonDraftFromTemplate,
  sermonTemplateFromSermon,
  seriesDraftFromTemplate,
  seriesTemplateFromSeries,
} from './sermonTemplates';

describe('reusable sermon and series templates', () => {
  it('copies content fields without identity, lifecycle, or schedule fields', () => {
    const source = {
      id: 'source-id',
      user_id: 'owner',
      title: 'Original',
      points: [{ title: 'Point' }],
      status: 'published',
      scheduled_date: '2026-08-25T12:00:00Z',
      scripture_validation: [{ reference: 'John 3:16' }],
    };
    const template = sermonTemplateFromSermon(source, 'Reusable');
    expect(template.content).toEqual({ title: 'Original', points: [{ title: 'Point' }] });
    source.points[0].title = 'Changed later';
    expect(template.content.points[0].title).toBe('Point');
  });

  it('always instantiates a private unscheduled draft', () => {
    const draft = sermonDraftFromTemplate({ name: 'Reusable', content: { topic: 'Grace' } });
    expect(draft).toMatchObject({ title: 'Reusable', topic: 'Grace', status: 'draft', scheduled_date: null });
  });

  it('orders a complete series blueprint and reconnects sermons on instantiation', () => {
    const template = seriesTemplateFromSeries(
      { title: 'Advent', description: 'Four weeks' },
      [
        { title: 'Week two', series_order: 2, status: 'published' },
        { title: 'Week one', series_order: 1, scheduled_date: '2026-12-01T12:00:00Z' },
      ],
    );
    expect(template.content.sermon_blueprints.map((entry) => entry.title)).toEqual(['Week one', 'Week two']);
    const drafts = seriesDraftFromTemplate(template);
    expect(drafts.series).toMatchObject({ title: 'Advent', length: 2, status: 'in_progress' });
    expect(drafts.sermons).toMatchObject([
      { title: 'Week one', series_order: 1, status: 'draft', scheduled_date: null },
      { title: 'Week two', series_order: 2, status: 'draft', scheduled_date: null },
    ]);
  });
});
