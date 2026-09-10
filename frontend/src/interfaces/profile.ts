import type { ReadingLevel } from '../models/assessment';

export interface BandResult {
  level: ReadingLevel;
  correct: number;
  total: number;
}

export interface ReadingProfileDto {
  languageName: string;
  level: ReadingLevel;
  cefr: string;
  answered: number;
  correct: number;
  vocabularyKnown: number;
  bands: BandResult[];
  strengths: string[];
  developing: string[];
  hasEnoughSignal: boolean;
}

export interface ReadingProfileResponse {
  profile: ReadingProfileDto | null;
}
