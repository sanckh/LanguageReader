import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { apiConfigured } from '../lib/api';
import { getChecks, getReadingProfile, startCheck } from '../assessment/api';
import type { ReadingProfileDto } from '../interfaces/profile';
import type { KnowledgeCheckDto } from '../interfaces/knowledgeCheck';
import { ProfileView } from '../components/ProfileView';
import { AssessmentModal } from '../assessment/AssessmentModal';
import { colors } from '../theme';

type Status = 'idle' | 'loading' | 'ready';

export function LearnerScreen() {
  const { session } = useAuth();
  const ready = Boolean(session) && apiConfigured();
  const [profile, setProfile] = useState<ReadingProfileDto | null>(null);
  const [checks, setChecks] = useState<KnowledgeCheckDto[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [activeCheck, setActiveCheck] = useState<{
    assessmentId: string;
    label: string;
  } | null>(null);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    let nextProfile: ReadingProfileDto | null = null;
    let nextChecks: KnowledgeCheckDto[] = [];
    try {
      nextProfile = (await getReadingProfile()).profile;
    } catch {
      nextProfile = null;
    }
    try {
      nextChecks = (await getChecks()).checks;
    } catch {
      nextChecks = [];
    }
    setProfile(nextProfile);
    setChecks(nextChecks);
    setStatus('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!ready) {
          setStatus('idle');
          return;
        }
        if (active) await refresh();
      })();
      return () => {
        active = false;
      };
    }, [ready, refresh]),
  );

  const openCheck = (difficulty: number) => {
    setOpening(true);
    setMessage(null);
    void (async () => {
      try {
        const check = await startCheck(difficulty);
        setActiveCheck({
          assessmentId: check.assessmentId,
          label: 'KNOWLEDGE CHECK · ' + check.level,
        });
      } catch {
        setMessage('Could not start that check. Please try again.');
      } finally {
        setOpening(false);
      }
    })();
  };

  const closeCheck = () => {
    setActiveCheck(null);
    void refresh();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>LANGUAGE READER</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Little by little.
        </Text>
        <Text style={styles.description}>
          See your understanding grow through reading.
        </Text>
        <View style={styles.body}>
          {!ready ? (
            <Text style={styles.muted}>
              Sign in to see your reading profile.
            </Text>
          ) : status === 'loading' ? (
            <ActivityIndicator
              accessibilityLabel="Loading your profile"
              color={colors.accent}
            />
          ) : profile ? (
            <ProfileView profile={profile} />
          ) : (
            <Text style={styles.muted}>
              Finish the onboarding assessment to see your reading profile.
            </Text>
          )}
        </View>
        {ready && status === 'ready' && checks.length > 0 && (
          <View style={styles.checks}>
            <Text style={styles.sectionLabel}>KNOWLEDGE CHECKS</Text>
            <Text style={styles.muted}>
              Optional — take these anytime to help tune your recommendations.
            </Text>
            {checks.map((check) => (
              <Pressable
                key={check.difficulty}
                accessibilityRole="button"
                disabled={opening}
                style={styles.check}
                onPress={() => openCheck(check.difficulty)}
              >
                <Text style={styles.checkLevel}>{check.level}</Text>
                <Text style={styles.checkMeta}>
                  {check.itemCount} question{check.itemCount === 1 ? '' : 's'}
                  {check.topics.length > 0
                    ? ' · ' + check.topics.join(', ')
                    : ''}
                </Text>
              </Pressable>
            ))}
            {message && (
              <Text accessibilityLiveRegion="polite" style={styles.muted}>
                {message}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      {activeCheck && (
        <AssessmentModal
          visible
          assessmentId={activeCheck.assessmentId}
          label={activeCheck.label}
          mode="check"
          onExit={closeCheck}
          onFinished={closeCheck}
        />
      )}
    </SafeAreaView>
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
    paddingTop: 36,
  },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 36,
  },
  title: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: { color: colors.muted, fontSize: 17, lineHeight: 27 },
  body: { marginTop: 36 },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  checks: { marginTop: 40, gap: 12 },
  sectionLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  check: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 6,
  },
  checkLevel: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  checkMeta: { color: colors.muted, fontSize: 14 },
});
