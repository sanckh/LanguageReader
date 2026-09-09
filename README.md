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
