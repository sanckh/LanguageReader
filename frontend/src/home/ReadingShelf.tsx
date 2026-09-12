import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { DocumentMetaResponse } from '../interfaces/document';
import type { LibraryBook } from '../interfaces/library';
import { getLibrary, importProviderBook } from '../library/api';
import { getHomeReading } from './reading';
import { colors } from '../theme';

export function ReadingShelf({ onOpen }: { onOpen: (id: string) => void }) {
  const [continuation, setContinuation] = useState<DocumentMetaResponse | null>(
    null,
  );
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const controller = new AbortController();
      const refresh = async () => {
        try {
          const [reading, catalog] = await Promise.all([
            getHomeReading(),
            getLibrary('included', controller.signal),
          ]);
          if (!active) return;
          setContinuation(reading.continuation);
          const authors = new Set<string>();
          setBooks(
            catalog
              .filter((book) => {
                const author = book.authors.join(',');
                if (
                  authors.has(author) ||
                  book.title === reading.continuation?.document.title
                )
                  return false;
                authors.add(author);
                return true;
              })
              .slice(0, 3),
          );
          setError(false);
        } catch {
          if (active) setError(true);
        } finally {
          if (active) setLoading(false);
        }
      };
      void refresh();
      return () => {
        active = false;
        controller.abort();
      };
      // Retry explicitly reloads this focused shelf.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revision]),
  );
  const open = async (book: LibraryBook) => {
    setOpening(book.id);
    try {
      onOpen(
        book.id.startsWith('wolne-lektury:')
          ? await importProviderBook(book.id.slice('wolne-lektury:'.length))
          : book.id,
      );
    } catch {
      setError(true);
    } finally {
      setOpening(null);
    }
  };
  const remaining =
    continuation?.document.wordCount != null && continuation.totalSections > 0
      ? Math.max(
          1,
          Math.ceil(
            (continuation.document.wordCount *
              (1 -
                (continuation.position?.sectionPosition ?? 0) /
                  continuation.totalSections)) /
              150,
          ),
        )
      : null;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        Continue Reading
      </Text>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Loading reading shelf"
          color={colors.accent}
        />
      ) : continuation ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(continuation.document.id)}
          style={styles.card}
        >
          <Text style={styles.title}>{continuation.document.title}</Text>
          <Text style={styles.body}>
            {continuation.document.authors.join(', ')}
          </Text>
          <Text style={styles.note}>
            {remaining === null
              ? 'Reading time unavailable'
              : `About ${remaining} minutes remaining · estimated at 150 words/min`}
          </Text>
          <Text style={styles.note}>
            Comprehension estimate not available yet
          </Text>
          <Text style={styles.link}>Continue reading →</Text>
        </Pressable>
      ) : (
        <Text style={styles.body}>
          Open a book from the Library and pick up where you left off here.
        </Text>
      )}
      <Text accessibilityRole="header" style={styles.heading}>
        Discover your next read
      </Text>
      <Text style={styles.note}>
        A few suggestions from the collection. Personalized recommendations are
        coming later.
      </Text>
      {books.map((book) => (
        <Pressable
          key={book.id}
          accessibilityRole="button"
          disabled={opening !== null}
          onPress={() => void open(book)}
          style={styles.card}
        >
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.body}>{book.authors.join(', ')}</Text>
          <Text style={styles.note}>
            Comprehension estimate not available yet
          </Text>
          <Text style={styles.link}>
            {opening === book.id ? 'Opening…' : 'Read in app →'}
          </Text>
        </Pressable>
      ))}
      {error && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setRevision((value) => value + 1)}
          style={styles.card}
        >
          <Text style={styles.link}>
            Couldn’t load this reading shelf. Tap to retry.
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  heading: { fontSize: 25, color: colors.ink, marginTop: 12 },
  card: {
    padding: 20,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.ink },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
