import type {
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
