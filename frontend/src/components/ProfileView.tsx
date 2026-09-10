import { StyleSheet, Text, View } from 'react-native';
import type { BandResult, ReadingProfileDto } from '../interfaces/profile';
import { colors } from '../theme';

function Section({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.listItem}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

function BandRow({ band }: { band: BandResult }) {
  const pct =
    band.total > 0 ? Math.round((band.correct / band.total) * 100) : 0;
  return (
    <View style={styles.bandRow}>
      <Text style={styles.bandLevel}>{band.level}</Text>
      <Text style={styles.bandScore}>
        {band.correct}/{band.total} ({pct}%)
      </Text>
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
        <Stat
          value={`${profile.correct}/${profile.answered}`}
          label="Answered correctly"
        />
        <Stat
          value={String(profile.vocabularyKnown)}
          label="Words checked & known"
        />
      </View>
      {profile.bands.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BY LEVEL</Text>
          {profile.bands.map((band) => (
            <BandRow key={band.level} band={band} />
          ))}
        </View>
      )}
      {profile.hasEnoughSignal ? (
        <>
          <Section label="STRENGTHS" items={profile.strengths} />
          <Section label="DEVELOPING" items={profile.developing} />
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STRENGTHS & WEAK SPOTS</Text>
          <Text style={styles.muted}>
            We&apos;ll map these as you read and take knowledge checks — a short
            assessment isn&apos;t enough to call them yet.
          </Text>
        </View>
      )}
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
  bandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  bandLevel: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  bandScore: { color: colors.muted, fontSize: 15 },
  listItem: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 23 },
});
