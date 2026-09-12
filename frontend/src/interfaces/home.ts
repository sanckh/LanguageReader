import type { ReadingProfileDto } from './profile';

export interface VocabularySnapshot {
  day: string;
  known: number;
}

export interface HomeSummary {
  profile: ReadingProfileDto | null;
  weeklyDelta: number | null;
}
