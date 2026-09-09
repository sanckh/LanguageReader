# CI and preview updates (card 12)

The workflow at `.github/workflows/ci.yml` runs on pull requests, pushes to
`main`, and manual dispatch. The Checks job installs locked dependencies, runs
frontend TypeScript/lint/format/unit checks, runs embedded database tests, then
starts an isolated local Supabase stack and runs the real SDK database/Storage
isolation suite. Local services stop even after failure.

Only a push to main publishes an EAS preview update, and only after Checks
succeeds. Manual dispatch runs checks only. Pull requests do not receive Expo
credentials or publish updates. Main runs are serialized to avoid overlapping
preview publications. This also covers direct pushes to main; use branch
protection if every change should go through a pull request.

## One-time setup before pushing to main

1. In GitHub, create/configure the `preview` environment. Add `EXPO_TOKEN` as
   an environment secret (or repository secret). Generate it in the intended Expo
   account and paste it directly into GitHub, never into source files or chat.
2. In the linked Expo project's EAS `preview` environment, set `APP_ENV=preview`,
   `EAS_PROJECT_ID=96f85c75-2a82-40fe-9b75-b51da596b0bb`, and the existing shared
   project's `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use plain-text/sensitive visibility
   usable by EAS Update, not secret-only build variables. Set
   `EXPO_PUBLIC_API_URL` when the API exists. Keep these identical to the
   installed preview build's settings so fingerprints match.
3. Allow GitHub Actions and the checkout/setup-node/Expo actions in the repository.
   The workflow uses Node 24 and pins EAS CLI 23.2.0.
4. After a PR check has run, make `Checks` required in the main branch's
   protection/ruleset. Workflow failure alone does not prevent someone merging.
5. Install a compatible preview native build. Merge a small JS-only change,
   confirm the workflow succeeds, then restart the preview app to download and
   load the update. Confirm production stays unchanged.

The publishing job fails clearly if credentials/configuration are missing.
It pulls and validates EAS preview variables before publishing. Do not merge
with publishing credentials enabled unless the changes are ready for preview.

## What is still pending

Express deployment remains pending cards 12a–12c and a hosting choice. No fake
successful deploy step is present. Add the backend's tests to Checks and its
preview deployment after that job, using the selected provider's credentials.
Card 12 remains In Progress until that dependency is implemented.

This workflow does not apply migrations to the shared hosted Supabase project,
create native binaries, publish a production OTA, or host the web export.
Apply reviewed migrations separately before preview code depends on them.
GitHub runs/branch protection, Expo secret configuration, and device OTA receipt
remain user acceptance steps because this change has not been pushed.

Local validation: frontend checks and five unit tests, two embedded Postgres
suites, and the real local Supabase SDK isolation suite passed September 9, 2026.
Workflow YAML parsing passed. The GitHub-hosted workflow itself has not run.

References: [Expo GitHub Actions](https://docs.expo.dev/eas-update/github-actions/),
[EAS environment variables](https://docs.expo.dev/eas/environment-variables/usage/),
[Supabase local CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

