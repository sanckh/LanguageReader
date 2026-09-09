import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { getSupabase } from '../lib/supabase';
import { handleAuthUrl } from './oauth';

type AuthState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
};
const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  error: null,
  configured: false,
});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const client = getSupabase();
  useEffect(() => {
    if (!client) {
      return;
    }
    let active = true;
    let receivedEvent = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true;
      if (active) {
        setSession(next);
        if (next) setError(null);
        setLoading(false);
      }
    });
    client.auth
      .getSession()
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (!receivedEvent) setSession(data.session);
        if (failure)
          setError(
            'Your saved session could not be restored. Please sign in again.',
          );
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError('Could not restore your session. Please try again.');
          setLoading(false);
        }
      });
    const receive = (url: string) => {
      handleAuthUrl(url).catch((failure: unknown) => {
        if (active)
          setError(
            failure instanceof Error ? failure.message : 'Sign-in failed.',
          );
      });
    };
    let linkSubscription:
      ReturnType<typeof Linking.addEventListener> | undefined;
    let appSubscription:
      ReturnType<typeof AppState.addEventListener> | undefined;
    if (Platform.OS !== 'web') {
      Linking.getInitialURL()
        .then((url) => {
          if (url && active) receive(url);
        })
        .catch(() => {
          if (active)
            setError('Could not open the sign-in link. Please try again.');
        });
      linkSubscription = Linking.addEventListener('url', ({ url }) =>
        receive(url),
      );
      const refresh = (state: string) => {
        if (state === 'active') client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      };
      refresh(AppState.currentState);
      appSubscription = AppState.addEventListener('change', refresh);
    }
    return () => {
      active = false;
      subscription.unsubscribe();
      linkSubscription?.remove();
      appSubscription?.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, [client]);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading: Boolean(client) && loading,
        error,
        configured: Boolean(client),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
