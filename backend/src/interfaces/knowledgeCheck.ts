import type { ReadingLevel } from "../models/assessment.js";

export interface KnowledgeCheckDto {
  difficulty: number;
  level: ReadingLevel;
  topics: string[];
  itemCount: number;
}

export interface KnowledgeChecksResponse {
  checks: KnowledgeCheckDto[];
}

export interface KnowledgeCheckSession {
  assessmentId: string;
  languageName: string;
  level: ReadingLevel;
}
