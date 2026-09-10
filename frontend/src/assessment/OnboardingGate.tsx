import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { apiConfigured } from '../lib/api';
import type { AssessmentDto } from '../interfaces/assessment';
import type { LanguageOptions } from '../interfaces/language';
import { colors } from '../theme';
import {
  getLanguageOnboarding,
  getOnboarding,
  setLanguages,
  startOnboarding,
} from './api';
import { AssessmentModal } from './AssessmentModal';
import { ErrorModal } from './ErrorModal';
import { LanguageSelectionModal } from './LanguageSelectionModal';
import { isOnboardingRequired, needsAutoStart } from './state';

type Step = 'language' | 'assessment' | 'error' | null;

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { session, configured } = useAuth();
  const ready = Boolean(session) && configured && apiConfigured();
  return (
    <>
      {children}
      {ready && <OnboardingController key={session?.user.id ?? 'anon'} />}
    </>
  );
}

function OnboardingController() {
  const [step, setStep] = useState<Step>(null);
  const [options, setOptions] = useState<LanguageOptions | null>(null);
  const [assessment, setAssessment] = useState<AssessmentDto | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssessmentStep = useCallback(async () => {
    const snapshot = await getOnboarding();
    if (!isOnboardingRequired(snapshot)) {
      setStep(null);
      return;
    }
    let current = snapshot.assessment;
    if (needsAutoStart(snapshot)) {
      current = (await startOnboarding()).assessment;
    }
    setAssessment(current);
    setStep('assessment');
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const languages = await getLanguageOnboarding();
      if (!languages.selection.learning) {
        setOptions(languages.options);
        setStep('language');
      } else {
        await loadAssessmentStep();
      }
    } catch {
      setError('We could not load your setup. Please try again.');
      setStep('error');
    }
  }, [loadAssessmentStep]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const submitLanguages = useCallback(
    (nativeCode: string, learningCode: string) => {
      setSaving(true);
      setError(null);
      void (async () => {
        try {
          await setLanguages(nativeCode, learningCode);
          await loadAssessmentStep();
        } catch {
          setError('We could not save your languages. Please try again.');
        } finally {
          setSaving(false);
        }
      })();
    },
    [loadAssessmentStep],
  );

  if (step === null) return null;
  return (
    <>
      {step === 'language' && options && (
        <LanguageSelectionModal
          visible={!dismissed}
          options={options}
          saving={saving}
          error={error}
          onSubmit={submitLanguages}
          onExit={() => setDismissed(true)}
        />
      )}
      {step === 'assessment' && assessment && (
        <AssessmentModal
          visible={!dismissed}
          assessmentId={assessment.id}
          languageName={assessment.language.name}
          onExit={() => setDismissed(true)}
          onFinished={() => void loadAssessmentStep()}
        />
      )}
      {step === 'error' && (
        <ErrorModal
          visible={!dismissed}
          message={error ?? 'Something went wrong.'}
          onRetry={() => void load()}
          onExit={() => setDismissed(true)}
        />
      )}
      {dismissed && (
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={styles.bannerSafe}
          pointerEvents="box-none"
        >
          <Pressable
            accessibilityRole="button"
            style={styles.banner}
            onPress={() => setDismissed(false)}
          >
            <Text style={styles.bannerText}>Resume getting set up</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bannerSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  banner: {
    backgroundColor: colors.accent,
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  bannerText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
