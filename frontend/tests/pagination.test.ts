/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../src/reader/pagination';
import type { MeasuredBlock, ReaderPage } from '../src/models/reader';

function para(
  id: string,
  text: string,
  height: number,
  topMargin = 18,
): MeasuredBlock {
  return { sectionId: id, kind: 'paragraph', text, height, topMargin };
}

function pageText(page: ReaderPage): string {
  return page.blocks.map((b) => b.text).join('');
}

test('packs whole blocks until the viewport fills', () => {
  const pages = paginate(
    [para('a', 'AAA', 100, 0), para('b', 'BBB', 100), para('c', 'CCC', 100)],
    // Two 100px blocks plus one 18px margin fit; the third spills over.
    250,
  );
  assert.equal(pages.length, 2);
  assert.deepEqual(
    pages[0]!.blocks.map((b) => b.sectionId),
    ['a', 'b'],
  );
  assert.deepEqual(
    pages[1]!.blocks.map((b) => b.sectionId),
    ['c'],
  );
});

test('the first block on a page pays no top margin', () => {
  // Block is exactly viewport-tall: it only fits if its margin is dropped.
  const pages = paginate([para('a', 'AAA', 300, 40)], 300);
  assert.equal(pages.length, 1);
  assert.equal(pages[0]!.blocks.length, 1);
});

test('splits a paragraph taller than a whole page across pages', () => {
  const full = 'word '.repeat(200).trim();
  const pages = paginate([para('a', full, 900, 0)], 300);
  assert.ok(pages.length >= 3, `expected >=3 pages, got ${pages.length}`);
  // No text is lost and none duplicated across the split (ignoring the spaces
  // trimmed at each break).
  const rejoined = pages
    .flatMap((p) => p.blocks.map((b) => b.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  assert.equal(rejoined, full);
  // Every page after the first begins as a continuation of the paragraph.
  for (let i = 1; i < pages.length; i += 1) {
    assert.equal(pages[i]!.blocks[0]!.continuation, true);
  }
  assert.equal(pages[0]!.blocks[0]!.continuation, false);
});

test('starts an oversized-for-remaining paragraph fresh rather than orphaning', () => {
  // 'a' fills most of the page; 'b' cannot meaningfully split into the sliver
  // left, so it should begin on page 2 as a whole, non-continuation block.
  const pages = paginate(
    [para('a', 'AAA', 280, 0), para('b', 'word '.repeat(50).trim(), 200)],
    300,
  );
  assert.equal(pages[0]!.blocks.length, 1);
  assert.equal(pages[1]!.blocks[0]!.sectionId, 'b');
  assert.equal(pages[1]!.blocks[0]!.continuation, false);
});

test('a heading moves to the next page instead of splitting', () => {
  const pages = paginate(
    [
      para('a', 'AAA', 260, 0),
      {
        sectionId: 'h',
        kind: 'heading',
        text: 'Chapter',
        height: 60,
        topMargin: 24,
      },
    ],
    300,
  );
  assert.equal(pages.length, 2);
  assert.equal(pages[1]!.blocks[0]!.sectionId, 'h');
  assert.equal(pages[1]!.blocks[0]!.kind, 'heading');
});

test('degenerate viewport yields a single empty page rather than looping', () => {
  assert.deepEqual(paginate([para('a', 'AAA', 100, 0)], 0), [{ blocks: [] }]);
  assert.deepEqual(paginate([], 300), [{ blocks: [] }]);
});

test('breaks on whitespace, never mid-word, when a break exists', () => {
  const text = 'alpha beta gamma delta epsilon zeta eta theta';
  const pages = paginate([para('a', text, 400, 0)], 120);
  for (const page of pages) {
    for (const block of page.blocks) {
      assert.doesNotMatch(block.text, /^\s|\s$/, 'fragment is trimmed');
      // Each fragment is whole words joined by single spaces.
      for (const word of block.text.split(' ')) {
        assert.ok(text.includes(word), `"${word}" is a real word`);
      }
    }
  }
  assert.equal(pages.map(pageText).join(' ').replace(/\s+/g, ' ').trim(), text);
});
