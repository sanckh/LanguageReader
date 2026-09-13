import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useReadingMode, useReaderState } from './ReadingMode';
import { emptyAssistance } from './stateStore';
import { WordLookup } from './WordLookup';
import type {
  AssistanceAnchor,
  AssistanceState,
} from '../interfaces/readerState';

export function SelectionHelp({
  anchor,
  text,
  isWord,
}: {
  anchor: AssistanceAnchor;
  text: string;
  isWord: boolean;
}) {
  const mode = useReadingMode();
  const access = useReaderState();
  const [state, setState] = useState(emptyAssistance);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const { section_id, start_offset, end_offset } = anchor;
  useEffect(() => {
    let active = true;
    if (!access) return;
    access
      .load({ section_id, start_offset, end_offset })
      .then((saved) => {
        if (active) {
          setState(saved);
          setLoaded(true);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [access, section_id, start_offset, end_offset, revision]);
  const update = (changes: Partial<AssistanceState>) => {
    const next = { ...state, ...changes };
    setState(next);
    access?.save(anchor, next);
  };
  const { attempt, revealed } = state;
  if (!loaded)
    return (
      <Pressable
        disabled={!failed}
        onPress={() => setRevision((value) => value + 1)}
        style={styles.action}
      >
        <Text style={styles.text}>
          {failed ? 'Couldn’t load saved help. Retry' : 'Loading saved help…'}
        </Text>
      </Pressable>
    );
  if (mode === 'learning' && !revealed)
    return (
      <View style={styles.content}>
        <Text style={styles.text}>What do you think it means?</Text>
        <TextInput
          accessibilityLabel="Your interpretation"
          placeholder="Your best guess…"
          placeholderTextColor="#D3E1D6"
          value={attempt}
          onChangeText={(attempt) => update({ attempt })}
          style={styles.input}
          multiline
          maxLength={1000}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!attempt.trim()}
          accessibilityState={{ disabled: !attempt.trim() }}
          onPress={() => update({ revealed: true })}
          style={[styles.action, !attempt.trim() && { opacity: 0.5 }]}
        >
          <Text style={styles.text}>Reveal meaning</Text>
        </Pressable>
      </View>
    );
  return (
    <View>
      {isWord ? (
        <WordLookup word={text} />
      ) : (
        <Text style={styles.note}>Sentence help is coming soon.</Text>
      )}
      {mode === 'learning' && (
        <Pressable
          accessibilityRole="button"
          style={styles.action}
          onPress={() => update({ revealed: false, attempt: '' })}
        >
          <Text style={styles.text}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 6 },
  text: { color: '#FFFFFF', fontSize: 14 },
  translation: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  note: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 220,
    paddingBottom: 6,
  },
  input: {
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9D2CC',
    borderRadius: 6,
    padding: 8,
    minHeight: 44,
    maxHeight: 96,
  },
  action: { minHeight: 44, justifyContent: 'center' },
});
