import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootTabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../auth/AuthProvider';
import { apiConfigured } from '../lib/api';
import {
  getDocumentMeta,
  getSections,
  saveReadingPosition,
} from '../reader/api';
import type {
  DocumentMetaDto,
  DocumentSectionDto,
  SavedPosition,
} from '../interfaces/document';
import type { MeasuredBlock, PlacedBlock, ReaderPage } from '../models/reader';
import { paginate } from '../reader/pagination';
import { SelectableParagraph } from '../reader/SelectableParagraph';
import { takeOpening } from '../reader/opening';
import { needsMoreSections } from '../reader/loading';
import { PlaceholderScreen } from '../components/PlaceholderScreen';
import { colors } from '../theme';

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, serif',
});

const MAX_CONTENT_WIDTH = 680;
const CONTENT_PADDING = 28;
const PAGE_VPAD = 24;
const FOOTER_RESERVE = 56;
const BATCH = 25;
const COVER_ID = '__cover__';

const PARAGRAPH_MARGIN = 18;
const HEADING_MARGIN = 28;

const EMPTY_HEIGHTS: Record<string, number> = {};

export function ReaderScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Reader'>>();
  const { session } = useAuth();
  const documentId = route.params?.documentId;
  if (!documentId) {
    return (
      <PlaceholderScreen
        title="Room to read."
        description="One story, a little curiosity, and help when you need it."
        emptyTitle="Your next chapter starts here"
        emptyDescription="Open a book from your Library and it will appear here, with word and sentence help close at hand."
      />
    );
  }
  if (!(Boolean(session) && apiConfigured())) {
    return (
      <PlaceholderScreen
        title="Room to read."
        description="One story, a little curiosity, and help when you need it."
        emptyTitle="Sign in to read"
        emptyDescription="Your reading and saved progress live with your account."
      />
    );
  }
  return <PagedReader key={documentId} documentId={documentId} />;
}

function topMarginFor(kind: DocumentSectionDto['kind']): number {
  return kind === 'heading' ? HEADING_MARGIN : PARAGRAPH_MARGIN;
}

function PagedReader({ documentId }: { documentId: string }) {
  const { width: windowWidth } = useWindowDimensions();

  const [opening] = useState(() => takeOpening(documentId));
  const [meta, setMeta] = useState<DocumentMetaDto | null>(
    opening?.document ?? null,
  );
  const [totalSections, setTotalSections] = useState(0);
  const [saved, setSaved] = useState<SavedPosition | null>(null);
  const [sections, setSections] = useState<DocumentSectionDto[]>(
    opening?.sections ?? [],
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    opening ? 'ready' : 'loading',
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [batchError, setBatchError] = useState(false);
  const [metadataError, setMetadataError] = useState(false);
  const [openRevision, setOpenRevision] = useState(0);

  // Measured heights keyed by section id, tagged with the width they were
  // measured at. A width change (rotation/resize) invalidates every height, so
  // heights taken at a stale width are ignored rather than reset in an effect.
  const [measured, setMeasured] = useState<{
    width: number;
    heights: Record<string, number>;
  }>({ width: 0, heights: EMPTY_HEIGHTS });

  const [viewport, setViewport] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const listRef = useRef<FlatList<ReaderPage>>(null);
  const loadedCount = useRef(opening?.sections.length ?? 0);
  const loadingMore = useRef(false);
  const restored = useRef(false);
  const lastSavedSection = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [footerOpacity] = useState(() => new Animated.Value(0));

  const contentWidth =
    Math.min(viewport?.width ?? windowWidth, MAX_CONTENT_WIDTH) -
    CONTENT_PADDING * 2;
  const pageWidth = viewport?.width ?? windowWidth;
  const packHeight = viewport
    ? viewport.height - PAGE_VPAD * 2 - FOOTER_RESERVE
    : 0;
  // Heights are valid only at the width they were taken; otherwise treat as
  // unmeasured so the measure layer re-runs at the new width.
  const heights =
    measured.width === contentWidth ? measured.heights : EMPTY_HEIGHTS;

  // Fast first load: metadata + the first batch of sections in parallel.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [metaResult, first] = await Promise.all([
          getDocumentMeta(documentId),
          opening
            ? Promise.resolve({ sections: opening.sections })
            : getSections(documentId, 0, 6),
        ]);
        if (!active) return;
        setMetadataError(false);
        setMeta(metaResult.document);
        setTotalSections(metaResult.totalSections);
        setSaved(metaResult.position);
        setSections(first.sections);
        loadedCount.current = first.sections.length;
        setStatus('ready');
      } catch {
        if (active) {
          if (opening) setMetadataError(true);
          else setStatus('error');
        }
      }
    })();
    return () => {
      active = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [documentId, openRevision, opening]);

  const orderedBlocks = useMemo<MeasuredBlock[]>(() => {
    if (!meta) return [];
    const cover: MeasuredBlock = {
      sectionId: COVER_ID,
      kind: 'heading',
      text: meta.title,
      topMargin: 0,
      height: heights[COVER_ID] ?? 0,
    };
    const rest = sections.map<MeasuredBlock>((section) => ({
      sectionId: section.id,
      kind: section.kind,
      text: section.body,
      topMargin: topMarginFor(section.kind),
      height: heights[section.id] ?? 0,
    }));
    return [cover, ...rest];
  }, [meta, sections, heights]);

  // Paginate the contiguous measured prefix, so pages appear as soon as the
  // first blocks are measured instead of waiting for the whole batch.
  const pages = useMemo<ReaderPage[]>(() => {
    if (packHeight <= 0) return [];
    const measured: MeasuredBlock[] = [];
    for (const block of orderedBlocks) {
      if (heights[block.sectionId] === undefined) break;
      measured.push(block);
    }
    if (measured.length === 0) return [];
    return paginate(measured, packHeight);
  }, [orderedBlocks, heights, packHeight]);

  const allMeasured =
    orderedBlocks.length > 0 &&
    orderedBlocks.every((b) => heights[b.sectionId] !== undefined);

  // Yield between batches so reading remains responsive during background loading.
  useEffect(() => {
    if (
      status !== 'ready' ||
      batchError ||
      loadingMore.current ||
      loadedCount.current >= totalSections ||
      !needsMoreSections(
        currentPage,
        pages.length,
        sections.length,
        totalSections,
        restored.current ? undefined : saved?.sectionPosition,
      ) ||
      pages.length === 0 ||
      !allMeasured
    ) {
      return;
    }
    loadingMore.current = true;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const next = await getSections(
            documentId,
            loadedCount.current,
            BATCH,
          );
          if (!active) return;
          if (next.sections.length === 0) {
            setTotalSections(loadedCount.current);
            return;
          }
          loadedCount.current += next.sections.length;
          setSections((prev) => [...prev, ...next.sections]);
        } catch {
          if (active) setBatchError(true);
        } finally {
          loadingMore.current = false;
        }
      })();
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
      loadingMore.current = false;
    };
  }, [
    status,
    currentPage,
    saved,
    batchError,
    pages.length,
    sections.length,
    allMeasured,
    totalSections,
    documentId,
  ]);

  // Restore the saved position once its page exists among the measured pages.
  useEffect(() => {
    if (restored.current || !saved || pages.length === 0) return;
    const index = pages.findIndex((page) =>
      page.blocks.some((block) => block.sectionId === saved.sectionId),
    );
    if (index < 0) return;
    restored.current = true;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: false });
      setCurrentPage(index);
    }, 0);
    return () => clearTimeout(timer);
  }, [saved, pages]);

  // Progress and remaining fade in after a beat rather than greeting the reader.
  useEffect(() => {
    if (status !== 'ready' || pages.length === 0) return;
    const animation = Animated.timing(footerOpacity, {
      toValue: 1,
      duration: 400,
      delay: 500,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [status, pages.length, footerOpacity]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= pages.length) return;
      listRef.current?.scrollToIndex({ index, animated: true });
      setCurrentPage(index);
    },
    [pages.length],
  );

  // Web: arrow keys turn pages.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goTo(currentPage + 1);
      else if (event.key === 'ArrowLeft') goTo(currentPage - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, currentPage]);

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (index === currentPage) return;
    setCurrentPage(index);
    const anchor = pages[index]?.blocks.find((b) => b.sectionId !== COVER_ID);
    if (!anchor || anchor.sectionId === lastSavedSection.current) return;
    lastSavedSection.current = anchor.sectionId;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const sectionId = anchor.sectionId;
    saveTimer.current = setTimeout(() => {
      void saveReadingPosition(documentId, sectionId, 0).catch(() => undefined);
    }, 900);
  };

  const onViewportLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (
      width > 0 &&
      height > 0 &&
      (viewport?.width !== width || viewport?.height !== height)
    ) {
      setViewport({ width, height });
    }
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator
            accessibilityLabel="Opening your book"
            color={colors.accent}
          />
        </View>
      </SafeAreaView>
    );
  }
  if (status === 'error' || !meta) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            We couldn&apos;t open this book. Please try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const sampleCount = Math.min(31, totalSections);
  const sample = orderedBlocks.slice(0, sampleCount + 1);
  const sampleReady =
    sampleCount > 0 &&
    sample.length === sampleCount + 1 &&
    sample.every((block) => heights[block.sectionId] !== undefined);
  const estimate =
    sampleReady && packHeight > 0
      ? Math.round(
          (paginate(sample, packHeight).length * totalSections) / sampleCount,
        )
      : 0;
  const progress = progressFor(
    currentPage,
    pages.length,
    sections.length,
    totalSections,
    estimate,
    allMeasured,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Mount separately from the loading view so web attaches its layout observer. */}
      <View
        key="reader-viewport"
        style={styles.viewport}
        onLayout={onViewportLayout}
      >
        {viewport && contentWidth > 0 && (
          <MeasureLayer
            blocks={orderedBlocks}
            width={contentWidth}
            meta={meta}
            known={heights}
            onMeasured={(id, height) =>
              setMeasured((prev) => {
                if (prev.width !== contentWidth) {
                  return { width: contentWidth, heights: { [id]: height } };
                }
                if (prev.heights[id] === height) return prev;
                return {
                  width: contentWidth,
                  heights: { ...prev.heights, [id]: height },
                };
              })
            }
          />
        )}
        {pages.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={pages}
            extraData={`${currentPage}:${contentWidth}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, index) => String(index)}
            getItemLayout={(_, index) => ({
              length: pageWidth,
              offset: pageWidth * index,
              index,
            })}
            onScrollToIndexFailed={() => undefined}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item }) => (
              <PageView
                page={item}
                meta={meta}
                width={pageWidth}
                selectionKey={`${currentPage}:${contentWidth}`}
              />
            )}
          />
        )}

        {Platform.OS === 'web' && pages.length > 1 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              style={[styles.pageButton, styles.pageButtonLeft]}
              onPress={() => goTo(currentPage - 1)}
            >
              <Text style={styles.pageButtonText}>‹</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next page"
              style={[styles.pageButton, styles.pageButtonRight]}
              onPress={() => goTo(currentPage + 1)}
            >
              <Text style={styles.pageButtonText}>›</Text>
            </Pressable>
          </>
        )}
      </View>

      {metadataError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpenRevision((value) => value + 1)}
          style={styles.retryBatch}
        >
          <Text style={styles.errorText}>
            Reading progress couldn’t load. Tap to retry.
          </Text>
        </Pressable>
      )}
      {batchError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setBatchError(false)}
          style={styles.retryBatch}
        >
          <Text style={styles.errorText}>
            More pages couldn’t load. Tap to retry.
          </Text>
        </Pressable>
      )}
      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <Text style={styles.footerText}>{progress.label}</Text>
        <Text style={styles.footerText}>{progress.remaining}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

function progressFor(
  currentPage: number,
  loadedPages: number,
  loadedSections: number,
  totalSections: number,
  estimate: number,
  allMeasured: boolean,
): { label: string; remaining: string } {
  if (loadedPages === 0) return { label: '', remaining: '' };
  if (totalSections === 0 || estimate === 0)
    return {
      label: `Page ${currentPage + 1}`,
      remaining: 'Calculating book length…',
    };
  const complete = loadedSections >= totalSections && allMeasured;
  const estimatedTotal = complete
    ? loadedPages
    : Math.max(loadedPages, estimate);
  const approximate = complete ? '' : 'about ';
  const human = currentPage + 1;
  const percent = Math.min(100, Math.round((human / estimatedTotal) * 100));
  const pagesLeft = Math.max(0, estimatedTotal - human);
  return {
    label: `Page ${human} of ${approximate}${estimatedTotal}  ·  ${percent}%`,
    remaining:
      pagesLeft === 0 && complete
        ? 'End of book'
        : `${approximate}${pagesLeft} pages left in book`,
  };
}

function MeasureLayer({
  blocks,
  width,
  meta,
  known,
  onMeasured,
}: {
  blocks: MeasuredBlock[];
  width: number;
  meta: DocumentMetaDto;
  known: Record<string, number>;
  onMeasured: (id: string, height: number) => void;
}) {
  const pending = blocks
    .filter((b) => known[b.sectionId] === undefined)
    .slice(0, 6);
  if (pending.length === 0) return null;
  return (
    <View
      style={[styles.measureLayer, { width }]}
      pointerEvents="none"
      aria-hidden
    >
      {pending.map((block) => (
        <View
          key={block.sectionId}
          onLayout={(event) =>
            onMeasured(block.sectionId, event.nativeEvent.layout.height)
          }
        >
          <BlockBody
            sectionId={block.sectionId}
            kind={block.kind}
            text={block.text}
            continuation={false}
            meta={meta}
          />
        </View>
      ))}
    </View>
  );
}

function PageView({
  page,
  meta,
  width,
  selectionKey,
}: {
  page: ReaderPage;
  meta: DocumentMetaDto;
  width: number;
  selectionKey: string;
}) {
  return (
    <View style={[styles.page, { width }]}>
      <View style={styles.pageContent}>
        {page.blocks.map((block, index) => (
          <View
            key={`${block.sectionId}-${index}`}
            style={index === 0 ? undefined : marginStyle(block)}
          >
            <BlockBody
              sectionId={block.sectionId}
              kind={block.kind}
              text={block.text}
              continuation={block.continuation}
              meta={meta}
              selectionKey={selectionKey}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function marginStyle(block: PlacedBlock) {
  if (block.continuation) return undefined;
  return {
    marginTop: block.kind === 'heading' ? HEADING_MARGIN : PARAGRAPH_MARGIN,
  };
}

function BlockBody({
  sectionId,
  kind,
  text,
  continuation,
  meta,
  selectionKey,
}: {
  sectionId: string;
  kind: DocumentSectionDto['kind'];
  text: string;
  continuation: boolean;
  meta: DocumentMetaDto;
  selectionKey?: string;
}) {
  if (sectionId === COVER_ID) {
    return (
      <View>
        {meta.authors.length > 0 && (
          <Text style={styles.brand}>{meta.authors.join(' · ')}</Text>
        )}
        <Text accessibilityRole="header" style={styles.title}>
          {meta.title}
        </Text>
      </View>
    );
  }
  if (kind === 'heading') {
    return <Text style={styles.heading}>{text}</Text>;
  }
  return selectionKey === undefined ? (
    <Text style={styles.paragraph}>{text}</Text>
  ) : (
    <SelectableParagraph
      key={selectionKey}
      text={text}
      width={MAX_CONTENT_WIDTH - CONTENT_PADDING * 2}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  viewport: { flex: 1, overflow: 'hidden' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  errorText: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  retryBatch: { padding: 12, minHeight: 44 },
  measureLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    alignSelf: 'center',
    zIndex: -1,
  },
  page: { height: '100%', alignItems: 'center' },
  pageContent: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: PAGE_VPAD,
  },
  brand: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 30,
    fontWeight: '600',
  },
  heading: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 22,
    fontWeight: '600',
  },
  paragraph: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 19,
    lineHeight: 32,
  },
  word: { color: colors.ink },
  pageButton: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    marginTop: -22,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  pageButtonLeft: { left: 8 },
  pageButtonRight: { right: 8 },
  pageButtonText: { color: colors.ink, fontSize: 26, lineHeight: 28 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  footerText: { color: colors.muted, fontSize: 12 },
  helpBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.ink,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  helpWord: { color: colors.paper, fontSize: 18, fontWeight: '600' },
  helpNote: { color: '#C9D2CC', fontSize: 14 },
  helpClose: {
    color: colors.paper,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
});
