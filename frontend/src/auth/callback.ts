// Accept only our exact callback destination. PKCE codes are exchanged by Supabase.
export function getCallbackCode(raw: string, expected: string): string | null {
  const url = new URL(raw);
  const target = new URL(expected);
  if (
    url.protocol !== target.protocol ||
    url.host !== target.host ||
    url.pathname !== target.pathname
  )
    return null;
  if (url.searchParams.has('error'))
    throw new Error(
      'Sign-in was declined or the link expired. Please try again.',
    );
  return url.searchParams.get('code');
}
