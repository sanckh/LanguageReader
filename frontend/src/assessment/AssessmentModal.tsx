import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AssessmentQuestion } from '../interfaces/assessment';
import type { ReadingProfileDto } from '../interfaces/profile';
import { ProfileView } from '../components/ProfileView';
import { colors } from '../theme';
import { getNextQuestion, getReadingProfile, submitAnswer } from './api';

type Props = {
  visible: boolean;
  assessmentId: string;
  label: string;
  mode?: 'onboarding' | 'check';
  onExit: () => void;
  onFinished: () => void;
};

type Phase = 'loading' | 'question' | 'finished' | 'error';

export function AssessmentModal({
  visible,
  assessmentId,
  label,
  mode = 'onboarding',
  onExit,
  onFinished,
}: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctKey, setCorrectKey] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ReadingProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadNext = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setSelected(null);
    setCorrectKey(null);
    try {
      const result = await getNextQuestion(assessmentId);
      if (result.finished || !result.question) {
        setPhase('finished');
        return;
      }
      setQuestion(result.question);
      setPhase('question');
    } catch {
      setError('We could not load the next question. Please try again.');
      setPhase('error');
    }
  }, [assessmentId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await loadNext();
    })();
    return () => {
      active = false;
    };
  }, [loadNext]);

  useEffect(() => {
    if (phase !== 'finished' || mode !== 'onboarding') return;
    let active = true;
    void (async () => {
      setProfileLoading(true);
      try {
        const result = await getReadingProfile();
        if (active) setProfile(result.profile);
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setProfileLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [phase, mode]);

  const answer = useCallback(
    (key: string) => {
      if (busy || selected || !question) return;
      setBusy(true);
      setSelected(key);
      void (async () => {
        try {
          const result = await submitAnswer(assessmentId, question.itemId, key);
          setCorrectKey(result.correctOptionKey);
          setFinished(result.finished);
          setAnswered((count) => count + 1);
        } catch {
          setSelected(null);
          setError('We could not save your answer. Please try again.');
          setPhase('error');
        } finally {
          setBusy(false);
        }
      })();
    },
    [assessmentId, busy, selected, question],
  );

  const answeredThis = selected !== null && correctKey !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onExit}
      presentationStyle="fullScreen"
    >
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>{label}</Text>
          {phase === 'loading' && (
            <ActivityIndicator
              accessibilityLabel="Loading the assessment"
              color={colors.accent}
              style={styles.spacer}
            />
          )}
          {phase === 'error' && (
            <View style={styles.spacer}>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {error}
              </Text>
              <Button
                title="Try again"
                color={colors.accent}
                onPress={() => void loadNext()}
              />
            </View>
          )}
          {phase === 'finished' && mode === 'check' && (
            <View style={styles.spacer}>
              <Text accessibilityRole="header" style={styles.title}>
                Check complete.
              </Text>
              <Text style={styles.body}>
                Thanks — this helps tune what we recommend for you.
              </Text>
              <Button title="Done" color={colors.accent} onPress={onFinished} />
            </View>
          )}
          {phase === 'finished' && mode === 'onboarding' && (
            <View style={styles.spacer}>
              <Text accessibilityRole="header" style={styles.title}>
                Your reading profile
              </Text>
              {profileLoading ? (
                <ActivityIndicator
                  accessibilityLabel="Building your profile"
                  color={colors.accent}
                />
              ) : profile ? (
                <ProfileView profile={profile} />
              ) : (
                <Text style={styles.body}>
                  We&apos;ve saved your assessment. Your profile will appear in
                  the Learner tab.
                </Text>
              )}
              <Button title="Done" color={colors.accent} onPress={onFinished} />
            </View>
          )}
          {phase === 'question' && question && (
            <View>
              <Text style={styles.counter}>Question {answered + 1}</Text>
              <Text accessibilityRole="header" style={styles.prompt}>
                {question.prompt}
              </Text>
              <View style={styles.options}>
                {question.options.map((option) => {
                  const isSelected = option.key === selected;
                  const isCorrect = option.key === correctKey;
                  const feedback =
                    answeredThis && isCorrect
                      ? styles.optionCorrect
                      : answeredThis && isSelected
                        ? styles.optionWrong
                        : null;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      disabled={answeredThis || busy}
                      style={[styles.option, feedback]}
                      onPress={() => answer(option.key)}
                    >
                      <Text style={styles.optionText}>{option.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {answeredThis && (
                <Button
                  title={finished ? 'See my result' : 'Next question'}
                  color={colors.accent}
                  onPress={
                    finished
                      ? () => setPhase('finished')
                      : () => void loadNext()
                  }
                />
              )}
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Exit for now" color={colors.muted} onPress={onExit} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 28,
    paddingTop: 40,
  },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 28,
  },
  spacer: { marginTop: 24, gap: 16 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  counter: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  prompt: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '600',
    marginBottom: 24,
  },
  options: { gap: 12, marginBottom: 24 },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  optionCorrect: { borderColor: colors.accent, backgroundColor: '#E7F0EA' },
  optionWrong: { borderColor: '#B4443A', backgroundColor: '#F6E4E1' },
  optionText: { color: colors.ink, fontSize: 17, fontWeight: '500' },
  footer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
  },
});
