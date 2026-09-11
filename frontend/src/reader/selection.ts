import type { SelectionRange } from '../models/selectionRange';

export function toggleWord(
  tokens: string[],
  previous: SelectionRange | null,
  index: number,
): SelectionRange | null {
  if (!previous) return { start: index, end: index };
  const start = Math.min(previous.start, previous.end);
  const end = Math.max(previous.start, previous.end);
  if (index >= start && index <= end) return null;
  const between =
    index < start
      ? tokens.slice(index + 1, start)
      : tokens.slice(end + 1, index);
  if (between.every((token) => /^\s*$/.test(token)))
    return { start: Math.min(index, start), end: Math.max(index, end) };
  return { start: index, end: index };
}
