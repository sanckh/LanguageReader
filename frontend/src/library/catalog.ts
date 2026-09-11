import type { LibraryBook } from '../interfaces/library';
import type { LibraryLevelFilter } from '../models/library';
import { libraryLabel } from '../localization/libraryLabels';

export const levelLabels = {
  1: 'Starter',
  2: 'Beginner',
  3: 'Developing',
  4: 'Intermediate',
};
export function categories(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
export function filterBooks(
  books: LibraryBook[],
  query: string,
  level: LibraryLevelFilter,
) {
  const search = query.trim().toLocaleLowerCase('pl');
  return books.filter(
    (book) =>
      (level === 'all' ||
        (level === 'unrated' ? book.level === null : book.level === level)) &&
      [
        book.title,
        ...book.authors,
        book.topic ?? '',
        book.kind ?? '',
        book.epoch ?? '',
        libraryLabel(book.topic),
        libraryLabel(book.kind),
        libraryLabel(book.epoch),
      ]
        .join(' ')
        .toLocaleLowerCase('pl')
        .includes(search),
  );
}

export function sourceLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
