import type { SelectionRange } from '../models/selectionRange';

export function sentenceRange(tokens: string[], index: number): SelectionRange {
  let start = index;
  let end = index;
  const endsSentence = (text: string) => /[.!?…]["'”’»)]*$/.test(text);
  while (start > 0 && !endsSentence(tokens[start - 1] ?? '')) start--;
  while (end < tokens.length - 1 && !endsSentence(tokens[end] ?? '')) end++;
  while (start < end && !tokens[start]?.trim()) start++;
  while (end > start && !tokens[end]?.trim()) end--;
  return { start, end };
}

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
