import { describe, expect, it } from 'vitest';
import { normalizeSharedSermonAnalytics } from './SermonAnalytics';

describe('SermonAnalytics shared-sermon compatibility', () => {
  it('uses the current server-owned source and engagement fields', () => {
    expect(normalizeSharedSermonAnalytics({
      id: 'shared-new',
      source_sermon_id: 'sermon-new',
      views_count: 12,
      forks_count: 3,
      ratings_count: 2,
      average_rating: 4.5,
    })).toMatchObject({
      source_sermon_id: 'sermon-new',
      views_count: 12,
      forks_count: 3,
      ratings_count: 2,
      average_rating: 4.5,
    });
  });

  it('maps historical SharedSermon field names without losing engagement', () => {
    expect(normalizeSharedSermonAnalytics({
      id: 'shared-old',
      sermon_id: 'sermon-old',
      view_count: 7,
      fork_count: 2,
      rating_count: 4,
      avg_rating: 3.75,
    })).toMatchObject({
      source_sermon_id: 'sermon-old',
      views_count: 7,
      forks_count: 2,
      ratings_count: 4,
      average_rating: 3.75,
    });
  });
});
