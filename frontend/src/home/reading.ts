import { getSupabase } from '../lib/supabase';
import { getDocumentMeta } from '../reader/api';
import type { HomeReading } from '../interfaces/homeReading';

export async function getHomeReading(): Promise<HomeReading> {
  const client = getSupabase();
  if (!client) throw new Error('Library unavailable');
  const recent = await client
    .from('reading_position')
    .select('document_id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent.error) throw recent.error;
  return {
    continuation: recent.data
      ? await getDocumentMeta(recent.data.document_id)
      : null,
  };
}
