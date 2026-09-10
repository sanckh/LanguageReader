import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { apiConfigured } from '../lib/api';
import { getReadingProfile } from '../assessment/api';
import type { ReadingProfileDto } from '../interfaces/profile';
import { ProfileView } from '../components/ProfileView';
import { colors } from '../theme';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function LearnerScreen() {
  const { session } = useAuth();
  const ready = Boolean(session) && apiConfigured();
  const [profile, setProfile] = useState<ReadingProfileDto | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!ready) {
          setStatus('idle');
          return;
        }
        setStatus('loading');
        try {
          const result = await getReadingProfile();
          if (active) {
            setProfile(result.profile);
            setStatus('ready');
          }
        } catch {
          if (active) setStatus('error');
        }
      })();
      return () => {
        active = false;
      };
    }, [ready]),
  );

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
          ) : status === 'error' ? (
            <Text style={styles.muted}>
              We could not load your profile. Try again in a moment.
            </Text>
          ) : profile ? (
            <ProfileView profile={profile} />
          ) : (
            <Text style={styles.muted}>
              Finish the onboarding assessment to see your reading profile.
            </Text>
          )}
        </View>
      </ScrollView>
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
  muted: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
