import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { getSupabase } from '../lib/supabase';
import { getCallbackCode } from './callback';

export function authRedirectUrl(): string {
  if (Platform.OS === 'web') return window.location.origin + '/';
  const environment = Constants.expoConfig?.extra?.environment ?? 'development';
  return (
    'language-reader' +
    (environment === 'production' ? '' : '-' + environment) +
    '://auth/callback'
  );
}

// Both Android Linking and the browser result may deliver the same code.
const exchanges = new Map<string, Promise<void>>();
export async function handleAuthUrl(url: string): Promise<void> {
  const code = getCallbackCode(url, authRedirectUrl());
  if (!code) return;
  const existing = exchanges.get(code);
  if (existing) return existing;
  const exchange = (async () => {
    const client = getSupabase();
    if (!client) throw new Error('Sign-in is not configured yet.');
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error)
      throw new Error(
        'This sign-in link could not be used. Try signing in again on this device.',
      );
  })();
  exchanges.set(code, exchange);
  // Keep only a small bounded set; never log or persist callback codes.
  if (exchanges.size > 10) exchanges.delete(exchanges.keys().next().value!);
  return exchange;
}

export async function signInWithProvider(
  provider: 'google' | 'apple',
): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Sign-in is not configured yet.');
  const settings = Constants.expoConfig?.extra;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(settings?.supabaseUrl + '/auth/v1/settings', {
      headers: { apikey: settings?.supabasePublishableKey },
      signal: controller.signal,
    });
    if (!response.ok || !(await response.json()).external?.[provider]) {
      throw new Error('Provider unavailable');
    }
  } catch {
    throw new Error(
      'This sign-in provider is unavailable. Please use email or try again later.',
    );
  } finally {
    clearTimeout(timer);
  }
  const redirectTo = authRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url)
    throw new Error(
      'This sign-in provider is unavailable. Please use email or try again later.',
    );
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') await handleAuthUrl(result.url);
}
