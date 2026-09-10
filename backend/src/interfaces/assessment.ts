import type {
  AssessmentItemType,
  AssessmentStatus,
  OnboardingState,
} from "../models/assessment.js";
import type { LanguageDto } from "./language.js";

export interface AssessmentDto {
  id: string;
  status: AssessmentStatus;
  completedAt: string | null;
  language: LanguageDto;
}

export interface OnboardingResponse {
  state: OnboardingState;
  assessment: AssessmentDto | null;
}

export interface AssessmentQuestionOption {
  key: string;
  text: string;
}

export interface AssessmentQuestion {
  itemId: string;
  type: AssessmentItemType;
  prompt: string;
  options: AssessmentQuestionOption[];
}

export interface NextQuestion {
  question: AssessmentQuestion | null;
  finished: boolean;
}

export interface AnswerResult {
  correct: boolean;
  correctOptionKey: string;
  finished: boolean;
}
