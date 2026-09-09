import { apiFetch } from '../lib/api';
import type { OnboardingResponse } from '../interfaces/assessment';
import type {
  LanguageOnboarding,
  LanguageSelection,
} from '../interfaces/language';

const ASSESSMENT_PATH = '/api/assessments/onboarding';
const LANGUAGES_PATH = '/api/onboarding/languages';

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
