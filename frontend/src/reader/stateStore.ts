import { getSupabase } from '../lib/supabase';
import type {
  AssistanceAnchor,
  AssistanceState,
  ReaderSettings,
} from '../interfaces/readerState';
import type { ReadingMode } from '../models/readingMode';

export const emptyAssistance = (): AssistanceState => ({
  attempt: '',
  revealed: false,
  translation: null,
  vocabulary_help: {},
});

export function createReaderStateStore(authUserId: string, documentId: string) {
  let owner: Promise<string> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  const cache = new Map<string, AssistanceState>();
  const pending = new Map<string, () => Promise<void>>();
  const client = getSupabase();
  const profile = () =>
    (owner ??= (async () => {
      if (!client) throw new Error('Connection unavailable');
      const { data, error } = await client
        .from('user_profile')
        .select('id')
        .eq('auth_user_id', authUserId)
        .single();
      if (error) {
        owner = undefined;
        throw error;
      }
      return data.id as string;
    })());
  const sequence = <T>(work: () => Promise<T>) => {
    const result = tail.catch(() => {}).then(work);
    tail = result;
    return result;
  };
  const write = (key: string, work: () => Promise<void>) => {
    pending.set(key, work);
    return sequence(async () => {
      if (pending.get(key) !== work) return;
      await work();
      if (pending.get(key) === work) pending.delete(key);
    });
  };
  return {
    async settings(): Promise<ReaderSettings> {
      const user_id = await profile();
      const { data, error } = await client!
        .from('reader_settings')
        .select('mode')
        .eq('user_id', user_id)
        .eq('document_id', documentId)
        .maybeSingle();
      if (error) throw error;
      return data ?? { mode: 'reading' };
    },
    saveMode(mode: ReadingMode) {
      return write('mode', async () => {
        const user_id = await profile();
        const { error } = await client!
          .from('reader_settings')
          .upsert({ user_id, document_id: documentId, mode });
        if (error) throw error;
      });
    },
    load(anchor: AssistanceAnchor): Promise<AssistanceState> {
      const key = JSON.stringify(anchor);
      const saved = cache.get(key);
      if (saved) return Promise.resolve(saved);
      return sequence(async () => {
        const cached = cache.get(key);
        if (cached) return cached;
        const user_id = await profile();
        const { data, error } = await client!
          .from('reader_assistance')
          .select('attempt,revealed,translation,vocabulary_help')
          .match({ user_id, document_id: documentId, ...anchor })
          .maybeSingle();
        if (error) throw error;
        const result = data ?? emptyAssistance();
        cache.set(key, result);
        return result;
      });
    },
    save(anchor: AssistanceAnchor, state: AssistanceState) {
      const key = JSON.stringify(anchor);
      cache.set(key, state);
      return write(key, async () => {
        const user_id = await profile();
        const { error } = await client!
          .from('reader_assistance')
          .upsert({ user_id, document_id: documentId, ...anchor, ...state });
        if (error) throw error;
      });
    },
    retry: () =>
      sequence(async () => {
        for (const [key, work] of pending) {
          await work();
          if (pending.get(key) === work) pending.delete(key);
        }
      }),
  };
}
