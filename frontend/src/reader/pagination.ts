import type { MeasuredBlock, PlacedBlock, ReaderPage } from '../models/reader';

// Pack measured blocks into pages that fill the viewport top-to-bottom, in the
// spirit of a Kindle page: break at block boundaries where possible, and split a
// paragraph that is taller than the remaining space (or taller than a whole
// page) proportionally by character count. Proportional splitting assumes an
// even line height across the paragraph — true enough for prose that the small
// over/underfill at a split is invisible, and it needs no extra measure passes.

// Don't bother splitting a paragraph to reclaim a sliver of space; starting it
// fresh on the next page reads better than a one-line orphan.
const MIN_SPLIT_HEIGHT = 48;

function findBreak(text: string, approxChar: number): number {
  const upper = Math.min(approxChar, text.length - 1);
  for (let i = upper; i > 0; i -= 1) {
    if (/\s/.test(text[i]!)) return i;
  }
  // No whitespace to break on (one very long token): break mid-token so we
  // still make forward progress rather than looping forever.
  return Math.max(1, Math.min(approxChar, text.length - 1));
}

export function paginate(
  blocks: MeasuredBlock[],
  viewportHeight: number,
): ReaderPage[] {
  if (viewportHeight <= 0) return [{ blocks: [] }];
  const pages: ReaderPage[] = [];
  let current: PlacedBlock[] = [];
  let used = 0;

  const flush = () => {
    pages.push({ blocks: current });
    current = [];
    used = 0;
  };

  for (const block of blocks) {
    let text = block.text;
    let continuation = false;
    // Margin applies only when the block isn't the first item on its page.
    let margin = current.length === 0 ? 0 : block.topMargin;

    // Headings (and anything we don't split) move whole to the next page when
    // they don't fit and the page already has content.
    if (block.kind !== 'paragraph') {
      if (used + margin + block.height > viewportHeight && current.length > 0) {
        flush();
        margin = 0;
      }
      current.push({
        sectionId: block.sectionId,
        kind: block.kind,
        text,
        continuation: false,
      });
      used += margin + block.height;
      continue;
    }

    let remainingHeight = block.height;
    while (remainingHeight > 0) {
      const available = viewportHeight - used - margin;
      if (remainingHeight <= available) {
        current.push({
          sectionId: block.sectionId,
          kind: 'paragraph',
          text,
          continuation,
        });
        used += margin + remainingHeight;
        break;
      }
      // Not enough room for the rest. Split into this page when a worthwhile
      // chunk fits, or when the page is empty and splitting is the only way to
      // make progress. Otherwise move the whole remainder to a fresh page.
      if (available >= MIN_SPLIT_HEIGHT || current.length === 0) {
        const fraction = Math.max(0, available) / remainingHeight;
        const breakAt = findBreak(text, Math.floor(text.length * fraction));
        const head = text.slice(0, breakAt).trimEnd();
        const tail = text.slice(breakAt).trimStart();
        const headHeight = remainingHeight * (breakAt / text.length);
        current.push({
          sectionId: block.sectionId,
          kind: 'paragraph',
          text: head,
          continuation,
        });
        remainingHeight -= headHeight;
        text = tail;
        continuation = true;
      }
      flush();
      margin = 0;
    }
  }

  if (current.length > 0) flush();
  return pages.length > 0 ? pages : [{ blocks: [] }];
}
