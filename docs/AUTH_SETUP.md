# Card 05: authentication setup and testing

## Implemented

Account includes email/password sign-up and sign-in, confirmation-email guidance, Google and Apple browser OAuth, and local-device sign-out. Supabase sessions persist through AsyncStorage on Android/iOS and SDK browser storage on web. Native token refresh follows app foreground state; web refresh is managed by Supabase. Never log session objects or tokens. Native storage is AsyncStorage, not encrypted secure storage.

OAuth uses PKCE. Web redirects to the current origin's root; Supabase processes the callback and restores the session. Native builds use a custom scheme and exchange the code, including when the app was closed. Duplicate native callback delivery is deduplicated. Sign-in must finish on the same device/browser that started it so its PKCE verifier is available.

The existing single main/production Supabase project is shared by every app variant. Provider secrets never belong in frontend/.env.local. The existing project URL and publishable key are sufficient for the app.

## Supabase dashboard configuration

Public Auth settings checked September 9, 2026: email enabled, sign-up enabled, email confirmation required; Google and Apple disabled. Provider buttons report unavailable until providers are enabled. The read-only MCP connection cannot change Auth settings.

In Authentication > URL Configuration, allow these exact native callback URLs:

- language-reader-development://auth/callback
- language-reader-preview://auth/callback
- language-reader://auth/callback

For web development allow http://localhost:8081/ and, if used, http://127.0.0.1:8081/. Add the real HTTPS deployed frontend origin with a trailing slash when it exists. Set Site URL to the actual frontend location. Do not use an invented production domain. Custom email templates must preserve Supabase's confirmation URL/redirect flow. Keep email confirmation enabled; users can also confirm and then sign in manually.

### Google

Create a Google OAuth Web application client, configure the consent screen/test audience, and set its authorized redirect URI to:

https://xtgwshklnforymmfsokg.supabase.co/auth/v1/callback

Add the actual frontend origins (including localhost for development). Enter the Google client ID and client secret in Supabase's Google provider settings and enable it. This implementation uses browser OAuth on Android too; it does not require Android native Google sign-in credentials/SHA fingerprints.

### Apple

Configure Sign in with Apple for a Services ID in Apple Developer, with the Supabase domain and the callback URL above as the return URL. Configure the corresponding Apple client ID and generated client-secret JWT in Supabase's Apple provider settings and enable it. Generating the secret requires Apple team ID, key ID, and signing key; keep the signing key outside the repository/frontend and follow Apple's/Supabase's secret rotation requirements. This implementation uses Apple's browser flow across platforms; it does not yet provide an iOS-native Apple button.

## Run and verify

From frontend/, run npm start for Android or npm run web for the browser. Native OAuth needs a new development/preview binary with the new dependencies and registered scheme; Expo Go is not the acceptance target.

1. In Account, create an account with an email you control (minimum eight-character password in the UI; server rules also apply). Confirm the email and sign in. Verify the displayed account email.
2. Close/reopen Android, or reload web. Confirm the account remains signed in, including after access-token expiry/refresh.
3. Sign out. Restart again and confirm it remains signed out.
4. Test Google and Apple after enabling providers. Test cancellation, wrong/expired links, and reopening a closed native app through the callback.
5. Try an invalid password and an unconfirmed account; verify a helpful error and no authenticated state.
6. Test offline startup with a previously saved session and reconnect for refresh. Local session display is not authorization: future private data operations must still rely on Supabase RLS/server JWT verification.

Local verification: TypeScript, ESLint, callback unit tests, web form rendering/empty-input validation/mode switching, and Android/iOS/web export. Successful account creation, provider login, native callbacks, and restart persistence have NOT been tested end to end. No test accounts or emails were created/sent by the agent.

Sources: https://supabase.com/docs/guides/auth/quickstarts/react-native ; https://supabase.com/docs/guides/auth/native-mobile-deep-linking ; https://supabase.com/docs/guides/auth/social-login/auth-google ; https://supabase.com/docs/guides/auth/social-login/auth-apple
