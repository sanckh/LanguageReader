import { Button, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  message: string;
  onRetry: () => void;
  onExit: () => void;
};

export function ErrorModal({ visible, message, onRetry, onExit }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onExit}
      presentationStyle="fullScreen"
    >
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            Something went wrong.
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
          <View style={styles.actions}>
            <Button title="Try again" color={colors.accent} onPress={onRetry} />
            <Button
              title="Exit for now"
              color={colors.accent}
              onPress={onExit}
            />
          </View>
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
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '600' },
  message: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  actions: { gap: 12, marginTop: 12 },
});
