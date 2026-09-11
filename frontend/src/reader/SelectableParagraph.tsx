import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { TextSelection } from '../models/textSelection';
import { toggleWord } from './selection';
import { colors } from '../theme';

export function SelectableParagraph({
  text,
  width,
}: {
  text: string;
  width: number;
}) {
  const container = useRef<View>(null);
  const words = useRef<Record<number, Text | null>>({});
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(36);
  const [measuredWidth, setMeasuredWidth] = useState(width);
  const tokens = text.split(/(\s+)/);
  const select = (index: number) => {
    const node = words.current[index];
    if (!node || !container.current) return;
    node.measureInWindow((x, y, wordWidth, height) => {
      container.current?.measureInWindow((parentX, parentY) => {
        setSelection((previous) => {
          const range = toggleWord(tokens, previous, index);
          return range
            ? {
                ...range,
                x: x - parentX + wordWidth / 2,
                y: y - parentY,
                height,
                minY: 8 - parentY,
              }
            : null;
        });
      });
    });
  };
  const from = selection ? Math.min(selection.start, selection.end) : -1;
  const to = selection ? Math.max(selection.start, selection.end) : -1;
  const bubbleWidth = Math.min(112, measuredWidth);
  return (
    <View
      ref={container}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[styles.container, selection && { zIndex: 20 }]}
    >
      <Text style={styles.paragraph}>
        {tokens.map((token, index) =>
          /^\s*$/.test(token) ? (
            <Text
              key={index}
              style={
                index >= from && index <= to ? styles.highlight : undefined
              }
            >
              {token}
            </Text>
          ) : (
            <Text
              key={index}
              ref={(node) => {
                words.current[index] = node;
              }}
              accessibilityRole="button"
              accessibilityHint="Tap to translate; tap a neighboring word to extend the phrase; tap a highlighted word to clear"
              accessibilityState={{ selected: index >= from && index <= to }}
              onPress={() => select(index)}
              style={
                index >= from && index <= to ? styles.highlight : undefined
              }
            >
              {token}
            </Text>
          ),
        )}
      </Text>
      {selection && (
        <View
          onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
          style={[
            styles.bubble,
            {
              width: bubbleWidth,
              left: Math.max(
                0,
                Math.min(
                  measuredWidth - bubbleWidth,
                  selection.x - bubbleWidth / 2,
                ),
              ),
              top:
                selection.y - bubbleHeight - 8 >= selection.minY
                  ? selection.y - bubbleHeight - 8
                  : selection.y + selection.height + 8,
            },
          ]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.selectedText}>translation</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  paragraph: {
    color: colors.ink,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    fontSize: 19,
    lineHeight: 32,
  },
  highlight: { backgroundColor: '#CFE8D8', color: '#214F39' },
  bubble: {
    position: 'absolute',
    marginBottom: 8,
    backgroundColor: colors.accent,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 20,
    elevation: 3,
  },
  selectedText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
