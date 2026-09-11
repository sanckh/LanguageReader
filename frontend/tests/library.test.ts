import assert from 'node:assert/strict';
import test from 'node:test';
import type { LibraryBook } from '../src/interfaces/library';
import { categories, filterBooks, sourceLink } from '../src/library/catalog';
import { libraryLabel } from '../src/localization/libraryLabels';

const book: LibraryBook = {
  id: 'a',
  title: 'Księga dżungli',
  authors: ['Rudyard Kipling'],
  translators: [],
  level: null,
  topic: 'Adventure',
  word_count: 100,
  source: null,
  attribution: null,
  license: null,
  source_notice: null,
  modification_notice: null,
  source_download_url: null,
  provider: null,
};

test('combined categories belong to each individual filter', () => {
  assert.deepEqual(categories('Epika, Liryka'), ['Epika', 'Liryka']);
  assert.deepEqual(categories('powieść, powieść przygodowa'), [
    'powieść',
    'powieść przygodowa',
  ]);
  assert.deepEqual(categories(null), []);
});

test('library search combines title, author, topic and level without treating unrated books as Starter', () => {
  const books = [
    book,
    { ...book, id: 'b', title: 'Another book', level: 1 as const },
  ];
  assert.deepEqual(filterBooks(books, ' KSIĘGA ', 'all'), [book]);
  assert.equal(filterBooks(books, 'kipling', 'all').length, 2);
  assert.equal(filterBooks(books, 'adventure', 1).length, 1);
  assert.deepEqual(filterBooks(books, '', 'unrated'), [book]);
  assert.deepEqual(filterBooks(books, 'no match', 'all'), []);
});

test('source links reject executable URLs and malformed data', () => {
  assert.equal(sourceLink('javascript:alert(1)'), null);
  assert.equal(sourceLink('https://user:pass@example.com'), null);
  assert.equal(sourceLink(null), null);
  assert.equal(sourceLink('not a url'), null);
  assert.equal(
    sourceLink('https://wolnelektury.pl/'),
    'https://wolnelektury.pl/',
  );
});

test('catalog metadata is searchable by literary kind and period', () => {
  const books = [{ ...book, kind: 'Epika', epoch: 'Romantyzm' }];
  assert.equal(filterBooks(books, 'epika', 'all').length, 1);
  assert.equal(filterBooks(books, ' ROMANTYZM ', 'all').length, 1);
  assert.equal(filterBooks(books, 'romanticism', 'all').length, 1);
  assert.equal(filterBooks(books, 'narrative', 'all').length, 1);
});

test('library labels translate without changing source values or unknown labels', () => {
  assert.equal(libraryLabel('powieść przygodowa'), 'Adventure novel');
  assert.equal(libraryLabel('Dramat'), 'Drama');
  assert.equal(libraryLabel('Epika, Liryka'), 'Narrative, Poetry');
  assert.equal(libraryLabel('Epika, New category'), 'Narrative, New category');
  assert.equal(libraryLabel('Liryka', 'en-US'), 'Poetry');
  assert.equal(libraryLabel('Liryka', 'pl'), 'Liryka');
  assert.equal(libraryLabel('New category'), 'New category');
  assert.equal(libraryLabel(null), '');
  const books = [{ ...book, topic: 'powieść przygodowa' }];
  assert.equal(filterBooks(books, 'adventure', 'all').length, 1);
  assert.equal(books[0].topic, 'powieść przygodowa');
});
