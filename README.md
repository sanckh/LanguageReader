# Language Reader

A Polish-first reading assistant for English-speaking learners.

## Required platforms

Web, Android, and iOS are first-class targets from the initial release (user requirement, September 9, 2026). Every feature and dependency must support all three, or provide an equivalent platform-specific implementation. Web is a supported product experience, including responsive layout and keyboard interaction.

The shared Expo application currently lives in `frontend/` and serves all three platforms. Launch targets are `npm run web`, `npm run android`, and `npm run ios` from that directory. `npm start` opens the shared development server; choose the desired platform from its terminal.

## Current implementation

[Trello card 01](https://trello.com/c/Q5GKZl4f): Expo managed-workflow app with strict TypeScript, typed React Navigation bottom tabs, and placeholder Reader, Library, Learner, and Account screens. Shared styling, safe-area handling, ESLint, and Prettier are included. No backend or account credentials are required.

The shared frontend lives in `frontend/`. Product references remain in `PROJECT_REFERENCE.md` and `reference/`. Backend, authentication, imports, and EAS configuration belong to later cards on the [Language Reader board](https://trello.com/b/4RMUkRvq/language-reader).

## Run

Use Node.js 22.13 or newer (Node 24 used for initial validation).

```sh
cd frontend
npm ci
npm start
```

From Expo's terminal, press `a` for an Android emulator or `i` for an iOS simulator (requires macOS and Xcode). A physical device can use an Expo Go version compatible with SDK 57. For a browser preview, run `npm run web`.

On this Windows machine, the PowerShell npm launcher resolves to a missing global npm installation. Use `& 'C:\Program Files\nodejs\npm.cmd' start` from `frontend/` as a workaround; the system installation was not changed.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npx expo install --check
npx expo export --platform all
```

TypeScript, ESLint, formatting, dependency compatibility, and Android/iOS/web production bundle exports passed on September 9, 2026. Bundle export does not establish native simulator runtime behavior. Native launch and interaction checks remain required before marking card 01 fully accepted.

Manual acceptance: launch through `expo start` on web, Android, and iOS; switch among all four tabs; verify matching content and selected labels; check Android Back navigation; and confirm readable scrolling with enlarged text and no overlap with system bars on native platforms. On web, also verify keyboard navigation and narrow/mobile and wide/desktop viewport layouts. Runtime acceptance remains pending on all three targets; successful bundle exports alone do not establish runtime behavior.

The initial dependency audit reports 16 moderate findings inherited through Expo's `xcode`/`uuid` tooling and React Navigation's `query-string`/`decode-uri-component` chain. No high or critical findings were reported. npm offers no React Navigation fix and suggests an incompatible Expo downgrade for the tooling chain, so no forced downgrade or unverified override was applied. Recheck these upstream advisories before release.

Stack reference: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [React Navigation setup](https://reactnavigation.org/docs/getting-started/).

## Card 02: environment and build setup

Run EAS commands from `frontend/`. Profiles in `eas.json` are `dev` (development client, internal distribution), `preview` (internal release build), `prod` (store build), and `dev-simulator` (iOS simulator). Each profile explicitly selects its matching EAS environment and APP_ENV. Native identifiers use `com.sanckh.languagereader` with `.development` or `.preview` suffixes so installations can coexist. Confirm this identifier namespace before the first store submission.

Copy `frontend/.env.example` to `frontend/.env.local` for local settings. Configure the same public variables separately in each EAS environment: EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. They are optional while this is a shell with no backend. Preview/production URLs must use HTTPS. These values are embedded in the client: never use Supabase service-role credentials or LLM secrets here. The backend will hold those credentials later.

Link the intended Expo project with `npx eas-cli@latest login` and `npx eas-cli@latest init`. The confirmed project UUID is the default in app.config.ts. EAS_PROJECT_ID can override it when intentionally targeting another project. The existing app is linked to EAS project 96f85c75-2a82-40fe-9b75-b51da596b0bb (languagereader). Signing credentials and device builds remain pending.

```sh
# Build an installable Android development client
npx eas-cli@latest build --platform android --profile dev
# Build for a registered physical iPhone
npx eas-cli@latest build --platform ios --profile dev
# After installation, serve JavaScript to the development client
npx expo start --dev-client
# Internal QA and store builds
npx eas-cli@latest build --platform all --profile preview
npx eas-cli@latest build --platform all --profile prod
```

Physical iOS builds need Apple signing and device registration. Install the build from the EAS result link, connect the device to Metro, then verify all four tabs and the environment-specific app name. EAS build execution and physical-device installation remain pending account/project setup and access to a test device.

Web uses the same app config and public settings. Set APP_ENV to development, preview, or production before `npm run web` or `npx expo export --platform web`. EAS native build profiles do not themselves build or host the website. On PowerShell, set the variant with `$env:APP_ENV = 'preview'`; on POSIX shells use `APP_ENV=preview npx expo export --platform web`.

Validated locally: TypeScript, ESLint, and Expo public-config resolution for development, preview, and production. Build profiles follow the [EAS configuration documentation](https://docs.expo.dev/build/eas-json/); environment handling follows [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## Card 03: native OTA updates

`expo-updates` is installed. Build profiles map `dev` to the `development` channel, `preview` to `preview`, and `prod` to `production`; `dev-simulator` inherits development. EAS creates the remote channels during builds. Local declarations alone do not establish remote channels or successful delivery.

The update endpoint uses the confirmed project UUID by default, with an optional EAS_PROJECT_ID override. Runtime compatibility uses Expo's fingerprint policy: native dependency or configuration changes require a matching new build. Keep build and update environment variables identical so the runtime fingerprints match.

Set APP_ENV and EAS_PROJECT_ID as plain-text variables in the matching EAS environments (APP_ENV=preview for preview, APP_ENV=production for production). EAS Update does not inherit the build profile's env block. Public API/Supabase settings must also match the installed build. Before publishing, confirm the intended account with `npx eas-cli@latest whoami` and project with `npx eas-cli@latest project:info`.

From `frontend/`, after linking the real Expo project:

```sh
npx eas-cli@latest build --platform android --profile preview
# Install this newly built APK before trying OTA delivery.
npx eas-cli@latest update --channel preview --environment preview --platform all --message "Preview OTA smoke test"
# Inspect the server-side channel mapping and update history:
npx eas-cli@latest channel:view preview
npx eas-cli@latest update:list --branch preview
```

Use `--platform ios` on the build command for a registered iPhone. Set local APP_ENV=preview and EAS_PROJECT_ID before the commands as well, for initial dynamic-config evaluation. Existing binaries from before this card need rebuilding to embed Expo Updates and the channel configuration. Expo Go or a Metro development session does not prove preview OTA delivery.

For acceptance, install the preview build and record its build ID. Make a temporary visible JS-only text change, publish to preview, and record the update group ID. Fully close and reopen the app with network access to download the update, then close and reopen again to load it. Confirm the text changes without reinstalling or running Metro, and that a production build remains unchanged. Restore the temporary text and publish the restoration to preview. Record device/OS, runtime version, build ID, update ID, and result. Native changes or a changed runtime fingerprint require a new binary.

Updates are checked on launch and downloaded in the background; the cached/embedded version starts immediately. An update is used on a subsequent launch, avoiding forced reloads during reading. Web continues through `expo export --platform web` and normal hosting deployment; these native OTA channels do not publish the website.

Production publishing is a separate release action after preview testing: use `--channel production --environment production` with matching production config. This card does not publish a production update.

Local validation: TypeScript, ESLint, formatting, resolved OTA settings for each environment, and rejection of cloud builds without a project ID. Remote preview publication and receipt remain pending an installed preview binary.

References: [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/), [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/), and [Expo Updates SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/updates/).

## Card 04: Supabase connection

Corey chose one shared main/production Supabase project to limit cost, superseding the original card's separate-environment requirement. Project ref: xtgwshklnforymmfsokg. Android and web are current test targets; iOS remains supported.

See supabase/README.md for the migration and health-check setup. Add the project URL and sb_publishable_ key to frontend/.env.local. The file is ignored by Git. The same pair will be used in each EAS app environment. The Supabase MCP connection is deliberately read-only, so migrations must be applied through the Supabase SQL editor or a separately authorized write-capable administrative tool.

The client, non-production Account connection diagnostic, SQL migration, and production health seed are implemented. TypeScript, lint, formatting, all-platform bundles, and configuration guards passed. Live SQL execution, project reads, and EAS variables remain pending; this is not a completed remote provisioning claim.
