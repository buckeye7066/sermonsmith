import React, { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { READER_BOOKS, resolveReaderEntry } from '@/lib/readerReference';
import { isBookInTranslation } from './TranslationBookChecker';

/** Shared, keyboard-accessible passage entry for the reader and jump dialog. */
export default function PassageNavigation({
  currentBook, currentChapter, currentVerse = null, currentTranslation,
  translationBookInfo, onJump, onCancel, submitLabel = 'Open passage',
}) {
  const id = useId();
  const [book, setBook] = useState(currentBook);
  const [chapter, setChapter] = useState(String(currentChapter));
  const [verse, setVerse] = useState(currentVerse == null ? '' : String(currentVerse));
  const [error, setError] = useState('');

  useEffect(() => {
    setBook(currentBook);
    setChapter(String(currentChapter));
    setVerse(currentVerse == null ? '' : String(currentVerse));
    setError('');
  }, [currentBook, currentChapter, currentVerse, currentTranslation]);

  const edit = (setter) => (event) => { setter(event.target.value); setError(''); };
  const submit = (event) => {
    event.preventDefault();
    let location;
    try {
      location = resolveReaderEntry(book, chapter, verse, {
        translation: currentTranslation, translationBookInfo,
      });
    } catch (err) {
      setError(err.message);
      return;
    }
    if (onJump(location.book, location.chapter, location.verse) === false) return;
    setBook(location.book);
    setChapter(String(location.chapter));
    setVerse(location.verse == null ? '' : String(location.verse));
    setError('');
  };

  return (
    <form onSubmit={submit} className="space-y-3 mb-4" aria-label="Passage navigation" noValidate>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div className="col-span-2">
          <Label htmlFor={`${id}-book`}>Book</Label>
          <Input id={`${id}-book`} list={`${id}-books`} value={book}
            onChange={edit(setBook)} placeholder="John or John 3:16" autoComplete="off"
            aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(error)} />
          <datalist id={`${id}-books`}>
            {READER_BOOKS.filter(({ name }) => isBookInTranslation(name, translationBookInfo))
              .map(({ name }) => <option key={name} value={name} />)}
          </datalist>
        </div>
        <div>
          <Label htmlFor={`${id}-chapter`}>Chapter</Label>
          <Input id={`${id}-chapter`} type="text" inputMode="numeric" value={chapter}
            onChange={edit(setChapter)} placeholder="3" aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        <div>
          <Label htmlFor={`${id}-verse`}>Verse (Optional)</Label>
          <Input id={`${id}-verse`} type="text" inputMode="numeric" value={verse}
            onChange={edit(setVerse)} placeholder="16" aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined} />
        </div>
      </div>
      <p id={`${id}-help`} className="text-sm text-gray-600 dark:text-gray-300">
        Type a book and numbers, or a full passage such as John 3:16 in the Book box. Press Enter to open.
      </p>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
