import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/AppNavigator';
import type { HomeSummary } from '../interfaces/home';
import { useAuth } from '../auth/AuthProvider';
import { getReadingProfile } from '../assessment/api';
import { recordVocabulary } from '../home/progress';
import { colors } from '../theme';
import { ReadingShelf } from '../home/ReadingShelf';

export function HomeScreen() {
  const { session } = useAuth();
  return (
    <HomeContent key={session?.user.id ?? 'guest'} userId={session?.user.id} />
  );
}

function HomeContent({ userId }: { userId?: string }) {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => ({ userId, revision }), [userId, revision]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const accountId = request.userId;
      if (!accountId) return;
      void (async () => {
        try {
          const { profile } = await getReadingProfile();
          const weeklyDelta = profile
            ? await recordVocabulary(
                accountId,
                profile.languageName,
                profile.vocabularyKnown,
              )
            : null;
          if (active) {
            setSummary({ profile, weeklyDelta });
            setError(false);
          }
        } catch {
          if (active) setError(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [request]),
  );
  const profile = summary?.profile;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>LANGUAGE READER / HOME</Text>
        <Text accessibilityRole="header" style={styles.title}>
          A few pages.{'\n'}A little more Polish.
        </Text>
        <Text style={styles.subtitle}>Make room for a story today.</Text>
        {userId && (
          <ReadingShelf
            key={userId}
            onOpen={(documentId) =>
              navigation.navigate('Reader', { documentId })
            }
          />
        )}
        <View style={styles.nudge}>
          <Text style={styles.eyebrow}>DAILY READING</Text>
          <Text style={styles.heading}>Five minutes, just for you.</Text>
          <Text style={styles.body}>
            Pick something that catches your eye. Read a little, and see where
            it takes you.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('Library', { scope: 'included' })
            }
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Find something to read →</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>YOUR LIBRARY</Text>
            <Text accessibilityRole="header" style={styles.heading}>
              Your books belong here.
            </Text>
            <Text style={styles.body}>
              Bring the stories you care about into your reading life.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('Library', { scope: 'private' })
              }
              style={styles.secondary}
            >
              <Text style={styles.link}>Add your own book →</Text>
            </Pressable>
            <Text style={styles.note}>
              EPUB, PDF & TXT uploads are coming soon.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              YOUR {profile?.languageName.toUpperCase() ?? 'POLISH'}
            </Text>
            {!userId ? (
              <>
                <Text style={styles.heading}>Your progress starts here.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Account')}
                  style={styles.secondary}
                >
                  <Text style={styles.link}>Sign in →</Text>
                </Pressable>
              </>
            ) : loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading your reading summary"
                color={colors.accent}
              />
            ) : error ? (
              <>
                <Text style={styles.body}>Your summary couldn’t load.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setLoading(true);
                    setRevision((value) => value + 1);
                  }}
                  style={styles.secondary}
                >
                  <Text style={styles.link}>Try again</Text>
                </Pressable>
              </>
            ) : profile ? (
              <>
                <Text style={styles.number}>
                  {profile.vocabularyKnown.toLocaleString()}
                </Text>
                <Text style={styles.body}>words likely known</Text>
                <Text style={styles.note}>
                  {summary?.weeklyDelta == null
                    ? 'Weekly change appears after a week of history on this device.'
                    : `${summary.weeklyDelta > 0 ? '+' : ''}${summary.weeklyDelta} compared with a week ago`}
                </Text>
                <Text style={styles.level}>
                  {profile.hasEnoughSignal
                    ? profile.level
                    : 'Reading level still taking shape'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Learner')}
                  style={styles.secondary}
                >
                  <Text style={styles.link}>Explore your progress →</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heading}>
                  Let’s find your starting point.
                </Text>
                <Text style={styles.body}>
                  Complete the reading assessment to see your vocabulary and
                  reading level.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Account')}
                  style={styles.secondary}
                >
                  <Text style={styles.link}>Set up your reading profile →</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    padding: 24,
    paddingTop: 40,
    gap: 20,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  title: {
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    fontSize: 38,
    lineHeight: 46,
    color: colors.ink,
  },
  subtitle: { color: colors.muted, fontSize: 17 },
  heading: {
    color: colors.ink,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    fontSize: 25,
    lineHeight: 32,
  },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  nudge: { backgroundColor: '#E8EEE6', padding: 24, borderRadius: 18, gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: 14,
  },
  primary: {
    alignSelf: 'flex-start',
    padding: 16,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.ink,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  secondary: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  number: {
    color: colors.ink,
    fontSize: 44,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  level: { color: colors.accent, fontSize: 17, fontWeight: '600' },
});
