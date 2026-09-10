import type { ReadingLevel } from '../models/assessment';

export interface ReadingProfileDto {
  languageName: string;
  level: ReadingLevel;
  cefr: string;
  vocabularyKnown: number;
  vocabularyRange: string;
  strengths: string[];
  developing: string[];
}

export interface ReadingProfileResponse {
  profile: ReadingProfileDto | null;
}
