import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { ConnectionCheck } from '../components/ConnectionCheck';
import { PlaceholderScreen } from '../components/PlaceholderScreen';
import { useAuth } from '../auth/AuthProvider';
import { authRedirectUrl, signInWithProvider } from '../auth/oauth';
import { getSupabase } from '../lib/supabase';
import { colors } from '../theme';

export function AccountScreen() {
  const { session, loading, error, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (failure) {
      setMessage(
        failure instanceof Error
          ? failure.message
          : 'Unable to sign in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    const client = getSupabase();
    if (!client) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !password) {
      throw new Error('Enter a valid email address and password.');
    }
    if (creating) {
      if (password.length < 8)
        throw new Error('Choose a password with at least 8 characters.');
      const { data, error } = await client.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: authRedirectUrl() },
      });
      if (error)
        throw new Error(
          'Account creation failed. Check your password requirements or try again later.',
        );
      setPassword('');
      if (!data.session)
        setMessage(
          'Check your email to confirm your account, then return here to sign in.',
        );
    } else {
      const { error } = await client.auth.signInWithPassword({
        email: address,
        password,
      });
      if (error)
        throw new Error(
          'Sign-in failed. Check your email and password, and confirm your email first.',
        );
      setPassword('');
    }
  }
  return (
    <PlaceholderScreen
      title="Your own space."
      description="Keep your reading life with you."
      emptyTitle={
        session ? 'Welcome back' : creating ? 'Create your account' : 'Sign in'
      }
      emptyDescription={
        session
          ? 'You are signed in to Language Reader.'
          : 'Use your email or continue with a connected account.'
      }
    >
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Restoring session"
          color={colors.accent}
        />
      ) : !configured ? (
        <Text style={styles.message}>Sign-in is not configured yet.</Text>
      ) : session ? (
        <View style={styles.form}>
          <Text style={styles.message}>
            {session.user.email ?? 'Signed-in account'}
          </Text>
          <Button
            title="Sign out"
            disabled={busy}
            color={colors.accent}
            onPress={() =>
              run(async () => {
                const { error } = await getSupabase()!.auth.signOut({
                  scope: 'local',
                });
                if (error)
                  throw new Error('Could not sign out. Please try again.');
              })
            }
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={creating ? 'new-password' : 'current-password'}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            style={styles.input}
            onSubmitEditing={() => {
              if (!busy) void run(submit);
            }}
          />
          <Button
            title={
              busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'
            }
            disabled={busy}
            onPress={() => run(submit)}
            color={colors.accent}
          />
          <Button
            title={
              creating
                ? 'Already have an account? Sign in'
                : 'New here? Create an account'
            }
            disabled={busy}
            onPress={() => {
              setCreating(!creating);
              setPassword('');
              setMessage('');
            }}
            color={colors.accent}
          />
          <Button
            title="Continue with Google"
            disabled={busy}
            onPress={() => run(() => signInWithProvider('google'))}
            color={colors.accent}
          />
          <Button
            title="Continue with Apple"
            disabled={busy}
            onPress={() => run(() => signInWithProvider('apple'))}
            color={colors.accent}
          />
        </View>
      )}
      {(message || error) && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message || error}
        </Text>
      )}
      {(__DEV__ || Constants.expoConfig?.extra?.environment === 'preview') && (
        <ConnectionCheck />
      )}
    </PlaceholderScreen>
  );
}
const styles = StyleSheet.create({
  form: { gap: 14 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 17,
    color: colors.ink,
  },
  message: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 16,
  },
});
