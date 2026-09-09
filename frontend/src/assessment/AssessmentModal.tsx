import {
  ActivityIndicator,
  Button,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AssessmentDto } from '../interfaces/assessment';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  assessment: AssessmentDto | null;
  loading: boolean;
  error: string | null;
  onExit: () => void;
  onRetry: () => void;
};

export function AssessmentModal({
  visible,
  assessment,
  loading,
  error,
  onExit,
  onRetry,
}: Props) {
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
        <View style={styles.content}>
          <Text style={styles.brand}>READING ASSESSMENT</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Let&apos;s find your starting point.
          </Text>
          <Text style={styles.description}>
            A short adaptive assessment estimates what you already know in{' '}
            {assessment?.language.name ?? 'your new language'}, so
            recommendations fit you from day one.
          </Text>
          {loading && !assessment ? (
            <ActivityIndicator
              accessibilityLabel="Preparing your assessment"
              color={colors.accent}
              style={styles.spacer}
            />
          ) : error ? (
            <View style={styles.spacer}>
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
              <Button
                title="Try again"
                color={colors.accent}
                onPress={onRetry}
              />
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.label}>SAVED AUTOMATICALLY</Text>
              <Text style={styles.panelText}>
                Your assessment is ready. The first questions arrive soon; you
                can leave and pick up exactly where you left off.
              </Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <Button
            title="Exit for now"
            color={colors.accent}
            onPress={onExit}
            disabled={loading && !assessment}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 28,
    paddingTop: 48,
  },
  brand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 28,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '600',
    marginBottom: 14,
  },
  description: { color: colors.muted, fontSize: 17, lineHeight: 27 },
  spacer: { marginTop: 36, gap: 16 },
  error: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  panel: {
    backgroundColor: colors.surface,
    padding: 26,
    borderRadius: 18,
    marginTop: 36,
  },
  label: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  panelText: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  footer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 28,
  },
});
