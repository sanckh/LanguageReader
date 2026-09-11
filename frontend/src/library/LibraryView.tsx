import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LibraryBook } from '../interfaces/library';
import type { LibraryScope } from '../models/library';
import { colors } from '../theme';
import { categories, filterBooks, levelLabels, sourceLink } from './catalog';
import { libraryLabel } from '../localization/libraryLabels';
import { importProviderBook, searchProviderBooks } from './api';
import type { ProviderBookResult } from '../interfaces/providerLibrary';

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, serif',
});
const jackets = [
  '#294B40',
  '#835242',
  '#495771',
  '#71613E',
  '#66526C',
  '#406466',
];

function BookJacket({ book }: { book: LibraryBook }) {
  const shade =
    [...book.title].reduce((sum, char) => sum + char.codePointAt(0)!, 0) %
    jackets.length;
  return (
    <View
      accessible={false}
      style={[styles.jacket, { backgroundColor: jackets[shade] }]}
    >
      <View style={styles.spine} />
      <Text numberOfLines={2} style={styles.jacketAuthor}>
        {book.authors.join(' · ') || 'YOUR LIBRARY'}
      </Text>
      <View style={styles.jacketRule} />
      <Text numberOfLines={4} style={styles.jacketTitle}>
        {book.title}
      </Text>
      <Text style={styles.jacketFoot}>POLSKA BIBLIOTEKA</Text>
    </View>
  );
}

export function LibraryView({
  books,
  scope,
  loading,
  error,
  signedIn,
  onScopeChange,
  onRetry,
  onSignIn,
  onOpenDocument,
}: {
  books: LibraryBook[];
  scope: LibraryScope;
  loading: boolean;
  error: string | null;
  signedIn: boolean;
  onScopeChange: (scope: LibraryScope) => void;
  onRetry: () => void;
  onSignIn: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [genre, setGenre] = useState('all');
  const [showGenres, setShowGenres] = useState(false);
  const [pageSize, setPageSize] = useState(40);
  const [selected, setSelected] = useState<LibraryBook | null>(null);
  const columns = width >= 1000 ? 4 : width >= 650 ? 3 : 2;
  const padding = width < 600 ? 20 : 40;
  const cardWidth =
    (Math.min(width, 1120) - padding * 2 - 20 * (columns - 1)) / columns;
  const visible = filterBooks(books, query, 'all').filter(
    (book) =>
      (level === 'all' || categories(book.kind).includes(level)) &&
      (genre === 'all' || categories(book.topic).includes(genre)),
  );
  const filters = [
    'all',
    ...Array.from(new Set(books.flatMap((book) => categories(book.kind)))).sort(
      (a, b) => libraryLabel(a).localeCompare(libraryLabel(b)),
    ),
  ];
  const genres = Array.from(
    new Set(books.flatMap((book) => categories(book.topic))),
  ).sort((a, b) => libraryLabel(a).localeCompare(libraryLabel(b)));
  const changeScope = (next: LibraryScope) => {
    if (next === scope) return;
    setQuery('');
    setLevel('all');
    setGenre('all');
    setSelected(null);
    onScopeChange(next);
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: padding }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>LANGUAGE READER / LIBRARY</Text>
        <Text
          accessibilityRole="header"
          style={[
            styles.title,
            width < 600 && { fontSize: 36, lineHeight: 42 },
          ]}
        >
          A little more Polish.{'\n'}One book at a time.
        </Text>
        <Text style={styles.subtitle}>
          Stories to get lost in. A language to grow into.
        </Text>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['included', 'private'] as const).map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === tab }}
              onPress={() => changeScope(tab)}
              style={[styles.tab, scope === tab && styles.activeTab]}
            >
              <Text
                style={[styles.tabText, scope === tab && styles.activeTabText]}
              >
                {tab === 'included' ? 'Included Library' : 'My Library'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sectionHeading}>
          <View style={styles.grow}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {scope === 'included'
                ? 'The Polish collection'
                : 'Your own bookshelf'}
            </Text>
            <Text style={styles.description}>
              {scope === 'included'
                ? 'Explore literature from Wolne Lektury.'
                : 'A space for the stories you bring with you. Only you can see them.'}
            </Text>
          </View>
          {signedIn && !loading && !error && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh library"
              onPress={onRetry}
              style={styles.refresh}
            >
              <Text style={styles.link}>Refresh</Text>
            </Pressable>
          )}
        </View>
        {signedIn && (
          <>
            <View style={styles.searchBox}>
              <Text accessible={false} style={styles.searchIcon}>
                ⌕
              </Text>
              <TextInput
                accessibilityLabel="Search books by title, author, genre or period"
                placeholder="Find a title, author, genre, or period"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setPageSize(40);
                }}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery('')}
                  style={styles.clear}
                >
                  <Text style={styles.link}>×</Text>
                </Pressable>
              )}
            </View>
            {scope === 'included' && (
              <>
                <ScrollView
                  horizontal
                  style={styles.filterScroll}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filters}
                >
                  {filters.map((filter) => (
                    <Pressable
                      key={filter}
                      accessibilityRole="button"
                      accessibilityState={{ selected: level === filter }}
                      onPress={() => {
                        setLevel(filter);
                        setPageSize(40);
                      }}
                      style={[
                        styles.filter,
                        level === filter && styles.activeFilter,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          level === filter && styles.activeFilterText,
                        ]}
                      >
                        {filter === 'all' ? 'All kinds' : libraryLabel(filter)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.description}>Genres</Text>
                <View style={styles.genreFilters}>
                  {[
                    'all',
                    ...(showGenres ? genres : genres.slice(0, 8)),
                    ...(!showGenres &&
                    genre !== 'all' &&
                    !genres.slice(0, 8).includes(genre)
                      ? [genre]
                      : []),
                  ].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: genre === value }}
                      onPress={() => {
                        setGenre(value);
                        setPageSize(40);
                      }}
                      style={[
                        styles.filter,
                        genre === value && styles.activeFilter,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          genre === value && styles.activeFilterText,
                        ]}
                      >
                        {value === 'all' ? 'All genres' : libraryLabel(value)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {genres.length > 8 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showGenres }}
                    onPress={() => setShowGenres((value) => !value)}
                    style={styles.refresh}
                  >
                    <Text style={styles.link}>
                      {showGenres
                        ? 'Show fewer genres'
                        : `Show all ${genres.length} genres`}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}
        {!signedIn ? (
          <View style={styles.empty}>
            <Text style={styles.emptySymbol}>▤</Text>
            <Text style={styles.emptyTitle}>Your next chapter starts here</Text>
            <Text style={styles.emptyText}>
              Sign in to explore the collection and keep your books together.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onSignIn}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.emptyText}>Finding your books…</Text>
          </View>
        ) : error ? (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            <Text style={styles.emptyTitle}>The shelf couldn’t load</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptySymbol}>
              {scope === 'private' ? '＋' : '▤'}
            </Text>
            <Text style={styles.emptyTitle}>
              {books.length
                ? 'No books found'
                : scope === 'private'
                  ? 'Make this shelf your own'
                  : 'A collection is taking shape'}
            </Text>
            <Text style={styles.emptyText}>
              {books.length
                ? 'Try another search, literary kind, or genre.'
                : scope === 'private'
                  ? 'Your personal EPUB, PDF, and text files will belong here. Book uploads are coming soon.'
                  : 'Our first Polish readings will appear here when they’re ready.'}
            </Text>
            {books.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuery('');
                  setLevel('all');
                  setGenre('all');
                }}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.count}>
              {visible.length} {visible.length === 1 ? 'BOOK' : 'BOOKS'} · IN
              POLISH
            </Text>
            <View style={styles.grid}>
              {visible.slice(0, pageSize).map((book) => (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`About ${book.title}, ${book.authors.join(', ')}`}
                  onPress={() => setSelected(book)}
                  style={({ pressed }) => [
                    styles.card,
                    { width: cardWidth, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <BookJacket book={book} />
                  <Text style={styles.topic} numberOfLines={1}>
                    {libraryLabel(book.topic) || 'Polish literature'}
                  </Text>
                  <Text style={styles.bookTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text style={styles.author} numberOfLines={2}>
                    {book.authors.join(', ') || 'Personal book'}
                  </Text>
                  <View style={styles.bookMeta}>
                    <Text style={styles.level}>
                      {libraryLabel(book.kind) ||
                        (book.level ? levelLabels[book.level] : '')}
                    </Text>
                  </View>
                  <Text style={styles.words}>
                    {book.word_count === null
                      ? libraryLabel(book.epoch)
                      : `${book.word_count.toLocaleString()} words`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {visible.length > pageSize && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setPageSize((size) => size + 40)}
                style={styles.secondary}
              >
                <Text style={styles.link}>
                  Show more books ({Math.min(pageSize, visible.length)} of{' '}
                  {visible.length})
                </Text>
              </Pressable>
            )}
          </>
        )}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {scope === 'included'
              ? 'Good stories. A few pages at a time.'
              : 'Your books stay personal.'}
          </Text>
          <Text style={styles.footerNote}>
            A little reading goes a long way.
          </Text>
        </View>
      </ScrollView>
      {selected && (
        <BookDetails
          book={selected}
          onClose={() => setSelected(null)}
          onOpenDocument={onOpenDocument}
        />
      )}
    </SafeAreaView>
  );
}

// Retained as a reusable import surface for the later personal-library flow.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ProviderBrowser({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<ProviderBookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const search = async () => {
    setLoading(true);
    setMessage(null);
    try {
      setBooks(await searchProviderBooks(query));
    } catch {
      setMessage('The Wolne Lektury catalog is unavailable right now.');
    } finally {
      setLoading(false);
    }
  };
  const add = async (href: string) => {
    setImporting(href);
    setMessage(null);
    try {
      await importProviderBook(href);
      onImported();
    } catch {
      setMessage('This book could not be added. Please try again.');
    } finally {
      setImporting(null);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.details}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.eyebrow}>WOLNE LEKTURY</Text>
              <Text style={styles.sectionTitle}>Find something to read</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}>
              <Text style={styles.link}>Close ×</Text>
            </Pressable>
          </View>
          <Text style={styles.description}>
            Search the public Polish catalog, then add a book to your Included
            Library for reading and language help.
          </Text>
          <View style={styles.searchBox}>
            <TextInput
              accessibilityLabel="Search Wolne Lektury"
              placeholder="Search titles"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              style={styles.searchInput}
              returnKeyType="search"
            />
            <Pressable onPress={() => void search()} style={styles.primary}>
              <Text style={styles.primaryText}>{loading ? '…' : 'Search'}</Text>
            </Pressable>
          </View>
          {message && (
            <Text accessibilityRole="alert" style={styles.emptyText}>
              {message}
            </Text>
          )}
          {books.map((book) => (
            <View key={book.href} style={styles.providerRow}>
              <View style={styles.grow}>
                <Text style={styles.bookTitle}>{book.title}</Text>
                <Text style={styles.description}>
                  Wolne Lektury public catalog
                </Text>
              </View>
              <Pressable
                disabled={Boolean(importing)}
                onPress={() => void add(book.href)}
                style={styles.secondary}
              >
                <Text style={styles.link}>
                  {importing === book.href ? 'Adding…' : 'Add'}
                </Text>
              </Pressable>
            </View>
          ))}
          {!books.length && !loading && (
            <Text style={styles.emptyText}>
              Search for a title or author to get started.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const PROVIDER_PREFIX = 'wolne-lektury:';

function BookDetails({
  book,
  onClose,
  onOpenDocument,
}: {
  book: LibraryBook;
  onClose: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const original = sourceLink(book.source),
    download = sourceLink(book.source_download_url);
  const open = async (url: string) => {
    try {
      setLinkError(null);
      await Linking.openURL(url);
    } catch {
      setLinkError('This link could not be opened. Please try again.');
    }
  };
  const read = () => {
    setOpening(true);
    setLinkError(null);
    void (async () => {
      try {
        const slug = book.id.startsWith(PROVIDER_PREFIX)
          ? book.id.slice(PROVIDER_PREFIX.length)
          : null;
        const documentId = slug ? await importProviderBook(slug) : book.id;
        onOpenDocument(documentId);
        onClose();
      } catch {
        setLinkError(
          'We couldn’t open this book for reading. Please try again.',
        );
      } finally {
        setOpening(false);
      }
    })();
  };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.details}>
          <View style={styles.detailHeader}>
            <Text style={styles.eyebrow}>ABOUT THIS BOOK</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close book details"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.link}>Close ×</Text>
            </Pressable>
          </View>
          <View style={styles.detailJacket}>
            <BookJacket book={book} />
          </View>
          <Text accessibilityRole="header" style={styles.detailTitle}>
            {book.title}
          </Text>
          <Text style={styles.subtitle}>{book.authors.join(', ')}</Text>
          {book.translators.length > 0 && (
            <Text style={styles.description}>
              Translated by {book.translators.join(', ')}
            </Text>
          )}
          <Text style={styles.detailMeta}>
            {[
              libraryLabel(book.topic),
              libraryLabel(book.kind),
              libraryLabel(book.epoch),
              book.level
                ? levelLabels[book.level]
                : 'Reading level not yet rated',
              book.word_count === null
                ? null
                : `${book.word_count.toLocaleString()} words`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Read in the app"
            disabled={opening}
            onPress={read}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>
              {opening ? 'Opening…' : 'Read in the app'}
            </Text>
          </Pressable>
          {original && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void open(original)}
              style={styles.secondary}
            >
              <Text style={styles.link}>Read the original ↗</Text>
            </Pressable>
          )}
          {download && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void open(download)}
              style={styles.secondary}
            >
              <Text style={styles.link}>Download EPUB ↗</Text>
            </Pressable>
          )}
          {linkError && (
            <Text accessibilityRole="alert" style={styles.emptyText}>
              {linkError}
            </Text>
          )}
          <View style={styles.credits}>
            {book.provider === 'wolne-lektury' && original && (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Wolne Lektury — original edition"
                onPress={() => void open(original)}
              >
                <Image
                  source={require('../../assets/wolne-lektury.png')}
                  style={{ width: 170, height: 64 }}
                  resizeMode="contain"
                />
              </Pressable>
            )}
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Source & credits
            </Text>
            <Text selectable style={styles.creditText}>
              {book.attribution ?? 'Source information has not been added.'}
            </Text>
            {book.modification_notice && (
              <Text selectable style={styles.creditText}>
                {book.modification_notice}
              </Text>
            )}
            {(book.source_notice ?? book.license) && (
              <Text selectable style={styles.creditText}>
                {book.source_notice ?? book.license}
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: 36,
    paddingBottom: 24,
    flexGrow: 1,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  title: {
    fontFamily: serif,
    fontSize: 46,
    lineHeight: 53,
    color: colors.ink,
    marginTop: 25,
    marginBottom: 12,
  },
  subtitle: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginTop: 32,
    marginBottom: 30,
    gap: 24,
  },
  tab: {
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: colors.accent },
  tabText: { fontSize: 16, color: colors.muted },
  activeTabText: { color: colors.ink, fontWeight: '700' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  browseButton: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  browseButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  grow: { flex: 1 },
  sectionTitle: {
    fontFamily: serif,
    fontSize: 25,
    color: colors.ink,
    marginBottom: 6,
  },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  refresh: { minHeight: 44, justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 27, color: colors.muted, marginRight: 10 },
  searchInput: { flex: 1, minHeight: 50, color: colors.ink, fontSize: 15 },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genreFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
  },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: 8, paddingVertical: 18, alignItems: 'center' },
  filter: {
    minHeight: 44,
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilter: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { color: colors.muted, fontSize: 13 },
  activeFilterText: { color: '#FFFFFF' },
  count: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, rowGap: 32 },
  card: { alignItems: 'stretch' },
  jacket: {
    minHeight: 224,
    padding: 21,
    paddingLeft: 25,
    borderRadius: 3,
    overflow: 'hidden',
    boxShadow: '2px 5px 9px rgba(35,61,53,0.15)',
  },
  spine: {
    position: 'absolute',
    left: 7,
    width: 2,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF22',
  },
  jacketAuthor: {
    color: '#F8EFE0',
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
  },
  jacketRule: {
    height: 1,
    width: 26,
    backgroundColor: '#DFCFAC',
    marginVertical: 18,
  },
  jacketTitle: {
    fontFamily: serif,
    fontSize: 24,
    lineHeight: 29,
    color: '#FFFCF4',
    flex: 1,
  },
  jacketFoot: {
    color: '#F8EFE0',
    fontSize: 7,
    letterSpacing: 1.5,
    marginTop: 18,
  },
  topic: {
    color: colors.accent,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 7,
  },
  bookTitle: {
    fontFamily: serif,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
  },
  author: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  bookMeta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 10,
  },
  level: { color: colors.muted, fontSize: 11 },
  words: { color: colors.muted, fontSize: 11, marginTop: 7 },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: colors.surface,
    marginTop: 12,
    gap: 14,
  },
  emptySymbol: { fontSize: 38, color: colors.accent },
  emptyTitle: {
    fontFamily: serif,
    fontSize: 26,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 390,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 9,
    paddingVertical: 15,
    paddingHorizontal: 25,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  secondary: { padding: 16, alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.border,
    marginTop: 44,
    paddingTop: 24,
    gap: 5,
  },
  footerText: { fontFamily: serif, color: colors.ink, fontSize: 19 },
  footerNote: { color: colors.muted, fontSize: 12 },
  details: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 26,
    paddingBottom: 48,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  close: {
    minHeight: 44,
    minWidth: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  detailJacket: { width: 170, marginBottom: 28 },
  detailTitle: {
    fontFamily: serif,
    fontSize: 36,
    lineHeight: 42,
    color: colors.ink,
    marginBottom: 12,
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 24,
    marginVertical: 18,
  },
  credits: {
    borderTopWidth: 1,
    borderColor: colors.border,
    marginTop: 22,
    paddingTop: 24,
    gap: 15,
  },
  creditText: { fontSize: 13, lineHeight: 22, color: colors.muted },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    gap: 12,
  },
});
