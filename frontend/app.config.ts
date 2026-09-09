import type { ConfigContext, ExpoConfig } from 'expo/config';

// Only public client configuration belongs here: Expo embeds extra in the app.
export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = process.env.APP_ENV ?? 'development';
  if (!['development', 'preview', 'production'].includes(environment)) {
    throw new Error('APP_ENV must be development, preview, or production');
  }
  const suffix = environment === 'production' ? '' : '.' + environment;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  for (const [name, value] of Object.entries({
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  })) {
    if (!value) continue;
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (environment !== 'development' && url.protocol !== 'https:')
    ) {
      throw new Error(name + ' must use HTTPS outside development');
    }
  }
  const projectId =
    process.env.EAS_PROJECT_ID || '96f85c75-2a82-40fe-9b75-b51da596b0bb';
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId,
    )
  ) {
    throw new Error('EAS_PROJECT_ID must be an Expo project UUID');
  }
  if (process.env.EAS_BUILD === 'true' && !projectId) {
    throw new Error(
      'EAS_PROJECT_ID is required for native builds with OTA updates',
    );
  }
  return {
    ...config,
    name:
      'Language Reader' +
      (environment === 'production'
        ? ''
        : environment === 'preview'
          ? ' (Preview)'
          : ' (Dev)'),
    slug: 'languagereader',
    scheme:
      'language-reader' +
      (environment === 'production' ? '' : '-' + environment),
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.sanckh.languagereader' + suffix,
    },
    android: {
      ...config.android,
      package: 'com.sanckh.languagereader' + suffix,
    },
    plugins: [...(config.plugins ?? []), 'expo-dev-client'],
    // A native dependency/config change produces a new runtime fingerprint.
    runtimeVersion: { policy: 'fingerprint' },
    updates: projectId
      ? {
          enabled: true,
          url: 'https://u.expo.dev/' + projectId,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        }
      : { enabled: false },
    extra: {
      ...config.extra,
      environment,
      apiUrl: apiUrl ?? null,
      supabaseUrl: supabaseUrl ?? null,
      supabasePublishableKey:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
