// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/apiClient', () => ({
  api: {
    integrations: {
      Core: {
        InvokeLLM: vi.fn().mockResolvedValue({
          suggestion_kind: 'transition',
          content: 'A brief transition.',
        }),
      },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/ai/personas', () => ({
  LARRY_SYSTEM_PROMPT: 'Larry',
}));

import PresentationMode, {
  calculateTimingStatus,
  getTimingCoachingTip,
  getTimingStateLabel,
} from './PresentationMode.jsx';

const sermon = {
  title: 'Hope',
  topic: 'Hope',
  big_idea: 'God is faithful.',
  conclusion: 'Trust God.',
  points: [
    {
      title: 'Remember',
      exegesis: 'Remember God’s faithfulness.',
      illustration: '',
      application: '',
      supporting_scriptures: ['Psalm 46:1'],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('elapsed-time presentation coaching', () => {
  it('classifies and describes an overlong introduction as a warning', () => {
    expect(calculateTimingStatus({
      elapsedTime: 241,
      targetTime: 30,
      currentPointIndex: -1,
      pointCount: 1,
    })).toEqual({
      status: 'warning',
      message: 'Consider moving to Point 1',
    });
    expect(getTimingCoachingTip('warning', 26)).toMatch(/introduction is running long/i);
    expect(getTimingStateLabel('warning')).toBe('move on');
  });

  it('updates the live coaching badge from current elapsed time', async () => {
    vi.useFakeTimers();

    render(<PresentationMode sermon={sermon} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTitle(/toggle elapsed-time coaching/i));
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(241_000);
    });

    expect(screen.getByText('Timed: move on')).toBeInTheDocument();
    expect(screen.getByText(/the introduction is running long/i)).toBeInTheDocument();
    expect(screen.getAllByText(/consider moving to point 1/i).length).toBeGreaterThan(0);
  });
});
