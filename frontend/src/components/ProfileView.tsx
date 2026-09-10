import { StyleSheet, Text, View } from 'react-native';
import type { ReadingProfileDto } from '../interfaces/profile';
import { colors } from '../theme';

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>Not enough signal yet.</Text>
      ) : (
        items.map((item) => (
          <Text key={item} style={styles.listItem}>
            • {item}
          </Text>
        ))
      )}
    </View>
  );
}

export function ProfileView({ profile }: { profile: ReadingProfileDto }) {
  return (
    <View style={styles.container}>
      <View style={styles.headline}>
        <Text style={styles.level}>{profile.level}</Text>
        <Text style={styles.cefr}>CEFR {profile.cefr} (approx.)</Text>
      </View>
      <View style={styles.stats}>
        <Stat value={String(profile.vocabularyKnown)} label="Words known" />
        <Stat value={profile.vocabularyRange} label="Estimated vocabulary" />
      </View>
      <Section label="STRENGTHS" items={profile.strengths} />
      <Section label="DEVELOPING" items={profile.developing} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  headline: { gap: 4 },
  level: { color: colors.ink, fontSize: 32, fontWeight: '700' },
  cefr: { color: colors.muted, fontSize: 15 },
  stats: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  stat: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    gap: 6,
  },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  statLabel: { color: colors.muted, fontSize: 13 },
  section: { gap: 8 },
  sectionLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  listItem: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 15 },
});
