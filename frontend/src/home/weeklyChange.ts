import type { VocabularySnapshot } from '../interfaces/home';

export function weeklyChange(
  history: VocabularySnapshot[],
  known: number,
  now: Date,
): number | null {
  const cutoff = new Date(now.getTime() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const baseline = history.filter((row) => row.day === cutoff).at(-1);
  return baseline ? known - baseline.known : null;
}
