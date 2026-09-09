import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const settings = Constants.expoConfig?.extra;
  const url = settings?.supabaseUrl as string | undefined;
  const key = settings?.supabasePublishableKey as string | undefined;
  if (!url || !key) return null;
  // Use durable native storage and browser localStorage via the Supabase SDK.
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      flowType: 'pkce',
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}

export async function checkSupabaseHealth(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase)
    throw new Error('Supabase is not configured for this environment.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await supabase
      .from('app_health')
      .select('environment, schema_version')
      .eq('id', 1)
      .abortSignal(controller.signal)
      .single();
    if (error)
      throw new Error(
        'Connection check failed. Verify the project settings and health-row setup.',
      );
    const expected = 'production';
    if (data.environment !== expected)
      throw new Error(
        'Environment mismatch: this app is connected to the wrong database.',
      );
    if (data.schema_version !== 1)
      throw new Error('The database health schema is not supported.');
    return 'Connected to ' + expected + '.';
  } finally {
    clearTimeout(timer);
  }
}
