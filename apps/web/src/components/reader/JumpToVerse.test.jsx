// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import JumpToVerse from './JumpToVerse.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderJumpToVerse({ currentChapter, currentTranslation }) {
  const onClose = vi.fn();
  const onJump = vi.fn();

  render(
    <JumpToVerse
      open
      onClose={onClose}
      onJump={onJump}
      currentBook="Romans"
      currentChapter={currentChapter}
      currentTranslation={currentTranslation}
    />,
  );

  return { onClose, onJump };
}

function submitVerse(verse) {
  fireEvent.change(screen.getByLabelText('Verse (Optional)'), {
    target: { value: String(verse) },
  });
  fireEvent.click(screen.getByRole('button', { name: /^jump$/i }));
}

describe('JumpToVerse translation-aware validation', () => {
  it('allows WEB Romans 14:26', () => {
    const { onClose, onJump } = renderJumpToVerse({
      currentChapter: 14,
      currentTranslation: 'web',
    });

    submitVerse(26);

    expect(onJump).toHaveBeenCalledWith('Romans', 14, 26);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rejects WEB Romans 16:26', () => {
    const { onClose, onJump } = renderJumpToVerse({
      currentChapter: 16,
      currentTranslation: 'en-web',
    });

    submitVerse(26);

    expect(screen.getByText('Romans 16 only has 25 verses.')).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('retains KJV Romans 14:23 as the canonical limit', () => {
    const { onClose, onJump } = renderJumpToVerse({
      currentChapter: 14,
      currentTranslation: 'kjv',
    });

    submitVerse(24);

    expect(screen.getByText('Romans 14 only has 23 verses.')).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('defers verse bounds for an unaudited translation', () => {
    const { onClose, onJump } = renderJumpToVerse({
      currentChapter: 14,
      currentTranslation: 'bbe',
    });

    submitVerse(24);

    expect(onJump).toHaveBeenCalledWith('Romans', 14, 24);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
