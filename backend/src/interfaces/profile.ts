import type { ReadingLevel } from "../models/assessment.js";

export interface ReadingProfileDto {
  languageName: string;
  level: ReadingLevel;
  cefr: string;
  vocabularyKnown: number;
  strengths: string[];
  developing: string[];
}

export interface ReadingProfileResponse {
  profile: ReadingProfileDto | null;
}
