import type { AssessmentStatus, OnboardingState } from '../models/assessment';
import type { LanguageDto } from './language';

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
