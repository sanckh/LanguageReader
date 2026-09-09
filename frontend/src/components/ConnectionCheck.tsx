import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { checkSupabaseHealth } from '../lib/supabase';
import { colors } from '../theme';

export function ConnectionCheck() {
  const [message, setMessage] = useState(
    'Check the connection for this app environment.',
  );
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    setMessage('Checking connection…');
    try {
      setMessage(await checkSupabaseHealth());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Connection check failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ paddingTop: 24, gap: 12 }}>
      <Button
        title={busy ? 'Checking…' : 'Check connection'}
        disabled={busy}
        onPress={check}
        color={colors.accent}
      />
      <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>
        {message}
      </Text>
    </View>
  );
}
