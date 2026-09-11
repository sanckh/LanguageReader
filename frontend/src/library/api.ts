import type { LibraryBook } from '../interfaces/library';
import type { LibraryScope } from '../models/library';
import { getSupabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import type { ProviderBookResult } from '../interfaces/providerLibrary';

export async function getLibrary(
  scope: LibraryScope,
  signal: AbortSignal,
): Promise<LibraryBook[]> {
  if ((scope as LibraryScope) === 'included') {
    const result = await apiFetch<{ books: ProviderBookResult[] }>(
      '/api/library/provider?q=',
    );
    return result.books.map((book) => ({
      id: `wolne-lektury:${book.href}`,
      title: book.title,
      authors: book.author ? [book.author] : [],
      translators: [],
      level: null,
      topic: book.genre || null,
      kind: book.kind,
      epoch: book.epoch,
      word_count: null,
      source: book.url || book.href,
      attribution: 'Książka pochodzi z serwisu Wolne Lektury.',
      license: null,
      source_notice: null,
      modification_notice: null,
      source_download_url: null,
      provider: 'wolne-lektury',
    }));
  }
  const client = getSupabase();
  if (!client) throw new Error('Library connection is unavailable.');
  const { data, error } = await client
    .from('document')
    .select(
      'id,title,authors,translators,level,topic,word_count,source,attribution,license,source_notice,modification_notice,source_download_url,provider,language!inner(code)',
    )
    .eq('is_included_library', scope === 'included')
    .eq('status', 'ready')
    .eq('language.code', 'pl')
    .order('title')
    .limit(500)
    .abortSignal(signal);
  if (error) throw new Error('We couldn’t load your books. Please try again.');
  return data as LibraryBook[];
}

export async function searchProviderBooks(
  query: string,
): Promise<ProviderBookResult[]> {
  const result = await apiFetch<{ books: ProviderBookResult[] }>(
    `/api/library/provider?q=${encodeURIComponent(query)}`,
  );
  return result.books;
}

export async function importProviderBook(slug: string): Promise<void> {
  await apiFetch('/api/library/provider/import', {
    method: 'POST',
    body: JSON.stringify({ slug, level: null, topic: null }),
  });
}
