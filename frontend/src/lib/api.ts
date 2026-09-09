import Constants from 'expo-constants';
import { getSupabase } from './supabase';

function baseUrl(): string | null {
  const url = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return url ? url.replace(/\/+$/, '') : null;
}

export function apiConfigured(): boolean {
  return Boolean(baseUrl());
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = baseUrl();
  if (!base) throw new Error('The API is not configured for this environment.');
  const client = getSupabase();
  if (!client)
    throw new Error('Sign-in is not configured for this environment.');
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in to continue.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(base + path, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error('The request failed. Please try again in a moment.');
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
