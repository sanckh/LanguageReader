import { useState } from 'react';
import { Button, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LanguageDto, LanguageOptions } from '../interfaces/language';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  options: LanguageOptions;
  saving: boolean;
  error: string | null;
  onSubmit: (nativeCode: string, learningCode: string) => void;
  onExit: () => void;
};

function firstCode(list: LanguageDto[]): string {
  return list.length === 1 ? (list[0]?.code ?? '') : '';
}

export function LanguageSelectionModal({
  visible,
  options,
  saving,
  error,
  onSubmit,
  onExit,
}: Props) {
  const [nativeCode, setNativeCode] = useState(() => firstCode(options.native));
  const [learningCode, setLearningCode] = useState(() =>
    firstCode(options.learning),
  );
  const ready = Boolean(nativeCode) && Boolean(learningCode) && !saving;
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
          <Text style={styles.brand}>WELCOME</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Set up your languages.
          </Text>
          <Text style={styles.description}>
            Tell us the language you speak and the one you want to learn.
          </Text>
          <LanguagePicker
            label="I SPEAK"
            options={options.native}
            selected={nativeCode}
            onSelect={setNativeCode}
          />
          <LanguagePicker
            label="I WANT TO LEARN"
            options={options.learning}
            selected={learningCode}
            onSelect={setLearningCode}
          />
          {error && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          )}
        </View>
        <View style={styles.footer}>
          <Button
            title={saving ? 'Saving…' : 'Continue'}
            color={colors.accent}
            disabled={!ready}
            onPress={() => onSubmit(nativeCode, learningCode)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function LanguagePicker({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: LanguageDto[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  return (
    <View style={styles.picker}>
      <Text style={styles.label}>{label}</Text>
      {options.map((option) => {
        const active = option.code === selected;
        return (
          <Pressable
            key={option.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onSelect(option.code)}
          >
            <Text
              style={[styles.optionText, active && styles.optionTextActive]}
            >
              {option.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  picker: { marginTop: 32, gap: 10 },
  label: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: '#FFFFFF' },
  optionText: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  optionTextActive: { color: colors.accent },
  error: { color: colors.ink, fontSize: 16, lineHeight: 24, marginTop: 24 },
  footer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 28,
  },
});
