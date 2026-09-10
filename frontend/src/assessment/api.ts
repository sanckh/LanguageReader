import { apiFetch } from '../lib/api';
import type {
  AnswerResult,
  NextQuestion,
  OnboardingResponse,
} from '../interfaces/assessment';
import type {
  LanguageOnboarding,
  LanguageSelection,
} from '../interfaces/language';
import type { ReadingProfileResponse } from '../interfaces/profile';
import type {
  KnowledgeChecksResponse,
  KnowledgeCheckSession,
} from '../interfaces/knowledgeCheck';

const ASSESSMENT_PATH = '/api/assessments/onboarding';
const LANGUAGES_PATH = '/api/onboarding/languages';
const ASSESSMENTS_BASE = '/api/assessments';
const PROFILE_PATH = '/api/profile';

export function getLanguageOnboarding(): Promise<LanguageOnboarding> {
  return apiFetch<LanguageOnboarding>(LANGUAGES_PATH);
}

export function setLanguages(
  nativeCode: string,
  learningCode: string,
): Promise<LanguageSelection> {
  return apiFetch<LanguageSelection>(LANGUAGES_PATH, {
    method: 'POST',
    body: JSON.stringify({ nativeCode, learningCode }),
  });
}

export function getOnboarding(): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>(ASSESSMENT_PATH);
}

export function startOnboarding(): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>(ASSESSMENT_PATH, { method: 'POST' });
}

export function getNextQuestion(assessmentId: string): Promise<NextQuestion> {
  return apiFetch<NextQuestion>(`${ASSESSMENTS_BASE}/${assessmentId}/next`);
}

export function submitAnswer(
  assessmentId: string,
  itemId: string,
  selectedOptionKey: string,
): Promise<AnswerResult> {
  return apiFetch<AnswerResult>(`${ASSESSMENTS_BASE}/${assessmentId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ itemId, selectedOptionKey }),
  });
}

export function getReadingProfile(): Promise<ReadingProfileResponse> {
  return apiFetch<ReadingProfileResponse>(PROFILE_PATH);
}

export function restartOnboarding(): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>(`${ASSESSMENT_PATH}/restart`, {
    method: 'POST',
  });
}

export function getChecks(): Promise<KnowledgeChecksResponse> {
  return apiFetch<KnowledgeChecksResponse>(`${ASSESSMENTS_BASE}/checks`);
}

export function startCheck(difficulty: number): Promise<KnowledgeCheckSession> {
  return apiFetch<KnowledgeCheckSession>(`${ASSESSMENTS_BASE}/checks`, {
    method: 'POST',
    body: JSON.stringify({ difficulty }),
  });
}
