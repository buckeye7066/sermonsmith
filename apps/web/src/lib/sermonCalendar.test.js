import { describe, expect, it } from 'vitest';
import {
  dateKey,
  monthGrid,
  monthLabel,
  schedulePatch,
  sermonsByScheduledDate,
  shiftMonth,
} from './sermonCalendar';

describe('sermon calendar planning', () => {
  it('builds a stable six-week month grid across year boundaries', () => {
    const grid = monthGrid('2026-01');
    expect(grid).toHaveLength(42);
    expect(grid[0].key).toBe('2025-12-28');
    expect(grid.at(-1).key).toBe('2026-02-07');
    expect(grid.filter((day) => day.inMonth)).toHaveLength(31);
  });

  it('groups scheduled sermons without timezone drift', () => {
    expect(sermonsByScheduledDate([
      { id: 'one', scheduled_date: '2026-08-25T23:30:00-04:00' },
      { id: 'two', scheduled_date: null },
    ])).toEqual({ '2026-08-25': [{ id: 'one', scheduled_date: '2026-08-25T23:30:00-04:00' }] });
  });

  it('creates a canonical date patch and a clear patch', () => {
    expect(schedulePatch('2026-12-24')).toEqual({ scheduled_date: '2026-12-24T12:00:00.000Z' });
    expect(schedulePatch('')).toEqual({ scheduled_date: null });
    expect(() => schedulePatch('tomorrow')).toThrow('Invalid schedule date');
  });

  it('shifts and labels months', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-08')).toBe('August 2026');
    expect(dateKey('2026-08-25T12:00:00Z')).toBe('2026-08-25');
  });
});
