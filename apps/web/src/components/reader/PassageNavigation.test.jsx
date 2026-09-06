// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PassageNavigation from './PassageNavigation';

afterEach(cleanup);
const props = { currentBook: 'Genesis', currentChapter: 1, currentTranslation: 'kjv' };
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.submit(screen.getByRole('form', { name: 'Passage navigation' }));

describe('typed passage navigation', () => {
  it('lets the reader edit all three fields before navigating', () => {
    const onJump = vi.fn();
    render(<PassageNavigation {...props} onJump={onJump} />);
    fill('Book', 'john'); fill('Chapter', '3'); fill('Verse (Optional)', '16');
    expect(onJump).not.toHaveBeenCalled();
    submit();
    expect(onJump).toHaveBeenCalledExactlyOnceWith('John', 3, 16);
    expect(screen.getByLabelText('Book')).toHaveValue('John');
  });
  it('opens a complete pasted reference with one form submission', () => {
    const onJump = vi.fn();
    render(<PassageNavigation {...props} onJump={onJump} />);
    fill('Book', '1 Cor 13:4'); submit();
    expect(onJump).toHaveBeenCalledExactlyOnceWith('1 Corinthians', 13, 4);
  });
  it('retains the previous passage when validation fails', () => {
    const onJump = vi.fn();
    render(<PassageNavigation {...props} onJump={onJump} />);
    fill('Chapter', '2.5'); submit();
    expect(screen.getByRole('alert')).toHaveTextContent('whole number');
    expect(onJump).not.toHaveBeenCalled();
    fill('Chapter', '2'); submit();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onJump).toHaveBeenCalledExactlyOnceWith('Genesis', 2, null);
  });
  it('resynchronizes all fields after external navigation', () => {
    const onJump = vi.fn();
    const view = render(<PassageNavigation {...props} onJump={onJump} />);
    fill('Book', 'unfinished');
    view.rerender(<PassageNavigation {...props} currentBook="John" currentChapter={3} currentVerse={16} onJump={onJump} />);
    expect(screen.getByLabelText('Book')).toHaveValue('John');
    expect(screen.getByLabelText('Chapter')).toHaveValue('3');
    expect(screen.getByLabelText('Verse (Optional)')).toHaveValue('16');
  });
  it('rejects unavailable testaments even when typed rather than selected', () => {
    const onJump = vi.fn();
    render(<PassageNavigation {...props} translationBookInfo={{ isNTOnly: true }} onJump={onJump} />);
    submit();
    expect(screen.getByRole('alert')).toHaveTextContent('not available');
    expect(onJump).not.toHaveBeenCalled();
  });
});
