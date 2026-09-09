import type { OnboardingResponse } from '../interfaces/assessment';

export function isOnboardingRequired(
  snapshot: OnboardingResponse | null,
): boolean {
  return snapshot !== null && snapshot.state !== 'completed';
}

export function needsAutoStart(snapshot: OnboardingResponse | null): boolean {
  return snapshot?.state === 'not_started';
}
