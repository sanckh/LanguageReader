import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = {
  children?: ReactNode;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};
export function PlaceholderScreen({
  title,
  description,
  emptyTitle,
  emptyDescription,
  children,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>LANGUAGE READER</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>A PLACE TO BEGIN</Text>
          <Text accessibilityRole="header" style={styles.emptyTitle}>
            {emptyTitle}
          </Text>
          <Text style={styles.description}>{emptyDescription}</Text>
        </View>
        {children}
        <Text style={styles.note}>Polish for English-speaking readers</Text>
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
  panel: {
    backgroundColor: colors.surface,
    padding: 26,
    borderRadius: 18,
    marginTop: 36,
    marginBottom: 24,
  },
  label: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 18,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 'auto',
    paddingTop: 28,
  },
});
