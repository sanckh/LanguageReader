import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren, RefObject } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReadingMode } from '../models/readingMode';
import { colors } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createReaderStateStore } from './stateStore';
import type { ReaderStateAccess } from '../interfaces/readerState';

const StateContext = createContext<ReaderStateAccess | null>(null);
export const useReaderState = () => useContext(StateContext);

const ModeContext = createContext<ReadingMode>('reading');
export const useReadingMode = () => useContext(ModeContext);
const BoundsContext = createContext<RefObject<View | null> | null>(null);
export const useReaderBounds = () => useContext(BoundsContext);

export function ReadingModes({
  children,
  userId,
  documentId,
}: PropsWithChildren<{ userId: string; documentId: string }>) {
  const [mode, setMode] = useState<ReadingMode>('reading');
  const [store] = useState(() => createReaderStateStore(userId, documentId));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    store
      .settings()
      .then((settings) => {
        if (active) {
          setMode(settings.mode);
          setReady(true);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [store, revision]);
  const access = useMemo<ReaderStateAccess>(
    () => ({
      load: store.load,
      save: (anchor, state) => {
        void store.save(anchor, state).catch(() => setError(true));
      },
    }),
    [store],
  );
  const changeMode = (value: ReadingMode) => {
    setMode(value);
    void store.saveMode(value).catch(() => setError(true));
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const content = useRef<View>(null);
  return (
    <ModeContext.Provider value={mode}>
      <StateContext.Provider value={access}>
        <SafeAreaView style={styles.header} edges={['top']}>
          {error && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!ready) setRevision((value) => value + 1);
                else
                  void store
                    .retry()
                    .then(() => setError(false))
                    .catch(() => setError(true));
              }}
            >
              <Text style={styles.hint}>
                Reading state couldn’t sync. Tap to retry.
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reader settings"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen(true)}
            style={styles.menuButton}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        </SafeAreaView>
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <SafeAreaView style={styles.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Dismiss reader settings"
              onPress={() => setMenuOpen(false)}
            />
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text accessibilityRole="header" style={styles.panelTitle}>
                  Reader settings
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close reader settings"
                  onPress={() => setMenuOpen(false)}
                  style={styles.menuButton}
                >
                  <Text style={styles.label}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>Reading mode</Text>
              <View style={styles.toggle} accessibilityRole="tablist">
                {(['reading', 'learning'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: value === mode }}
                    disabled={!ready}
                    onPress={() => changeMode(value)}
                    style={[styles.option, value === mode && styles.active]}
                  >
                    <Text
                      style={[
                        styles.label,
                        value === mode && styles.activeLabel,
                      ]}
                    >
                      {value === 'reading' ? 'Reading' : 'Learning'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>
                {mode === 'reading'
                  ? 'Tap for meaning · Hold for a sentence'
                  : 'Try your own meaning before revealing help'}
              </Text>
            </View>
          </SafeAreaView>
        </Modal>
        <BoundsContext.Provider value={content}>
          <View ref={content} collapsable={false} style={styles.content}>
            {children}
          </View>
        </BoundsContext.Provider>
      </StateContext.Provider>
    </ModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
  },
  content: { flex: 1 },
  menuButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 20, color: colors.muted },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
    padding: 16,
    alignItems: 'flex-end',
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 3,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 22,
    justifyContent: 'center',
    borderRadius: 22,
  },
  active: { backgroundColor: colors.ink },
  label: { color: colors.muted, fontWeight: '600' },
  activeLabel: { color: '#FFFFFF' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
