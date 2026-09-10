import type { AssessmentItemType } from "../models/assessment.js";

export interface PackItem {
  type: AssessmentItemType;
  lemma?: string;
  prompt?: string;
  difficulty: number;
  correct: string;
  distractors: string[];
  concepts?: string[];
  frequencyBand?: number;
}

export interface AssessmentPack {
  language: string;
  baseLanguage: string;
  version: number;
  items: PackItem[];
}

export interface AssessmentOption {
  key: string;
  text: string;
}

export interface NormalizedItem {
  itemKey: string;
  version: number;
  itemType: AssessmentItemType;
  difficulty: number;
  targetLemma: string | null;
  prompt: string;
  options: AssessmentOption[];
  correctOptionKey: string;
  correctText: string;
  metadata: Record<string, unknown>;
}
