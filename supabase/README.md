# Supabase setup

## Cards 07–09: learner, content/activity, and assessment schema

Apply migrations in filename order after card 06:

- `20260909000300_learner_model.sql`: user_profile, knowledge_confidence, evidence_log.
- `20260909000400_content_activity.sql`: document, document_lexeme_freq,
  reading_session, word_lookup_event, sentence_assistance_event, review_item.
- `20260909000500_assessment.sql`: assessment, assessment_response.

All application `user_id` and `owner_id` values reference `user_profile.id`.
Resolve the signed-in Auth UUID through the unique `user_profile.auth_user_id`
relationship. These migrations do not automatically provision profiles on signup.
Parent deletion is restricted while dependent rows exist; account erasure and
retention workflows need a later explicit implementation.

Knowledge is unique per user/language/lexeme and constrained to 0–100. A composite
foreign key prevents assigning a lexeme to the wrong language. Updates refresh
`updated_at`. Evidence permits SELECT/INSERT for the service role and blocks
UPDATE, DELETE, and TRUNCATE with a trigger as well as grants. An administrator
can still alter the schema or disable triggers; this is application-level
immutability, not protection against a database administrator. The draft's delta
log is retained; scoring-version/input snapshots for full recomputation remain
future work.

A document has either a non-null owner and `is_included_library=false`, or a null
owner and `is_included_library=true`, enforced by a check. Document source/status
are nonblank text to avoid prematurely fixing the import lifecycle. Session
counts cannot be negative; frequency counts must be positive. Lookup forms must
belong to the recorded lexeme. Assistance steps are 1–5, in the technical doc's
progressive-assistance order. Review strength is a finite nonnegative number;
the scoring algorithm is not implemented here.

Assessment statuses are `in_progress`, `completed`, and `abandoned`. Only completed
assessments have a completion timestamp. Response `item_id` is an opaque nonblank
text identifier because no question-bank table exists in the sketch.
`difficulty_at_time` is a required finite numeric snapshot in the eventual
question bank's scale, not a live lookup. Repeated item responses are allowed
until retry/attempt semantics are specified.

These eleven tables have RLS enabled and no anonymous/authenticated client
privileges or policies yet. Only the trusted service role can access them;
card 10 will add per-user client policies and ownership-join checks. Server-side
writes must validate document access and language consistency across content
and activity. These migrations alone do not implement application authorization.

Run the same local test commands below. Both suites passed against a fresh
embedded Postgres database on September 9, 2026, including the full migration
chain with a minimal `auth.users` fixture. Tests cover duplicate knowledge,
invalid relationships and values, evidence mutation denial, document ownership,
event indexes, assessment snapshots, and closed client access. Live Supabase
application remains pending; no remote SQL is executed by these tests.

## Card 06: linguistic reference tables

Apply `migrations/20260909000200_linguistic_core.sql` after the health migration,
once, using the existing project's SQL editor or migration tooling. This creates
the five tables in architecture section 7: language, lexeme, surface_form,
meaning, and example_sentence. No live migration has been applied by this change.

All IDs are generated UUIDs. Language codes are unique; callers should use a
consistent language-code convention. Capabilities and grammatical features are
JSON objects with no language-specific keys imposed by the database. Part of
speech, provenance, and translated example text may be absent. Homonyms may share
a lemma/POS and a spelling may have multiple analyses. Source/target example
columns retain the draft's Polish-to-English convention; translation-language
metadata would require a later extension for multilingual translations.

Every foreign key has an index. Parent deletion is restricted while reference
rows exist, so removing a language or lexeme cannot silently erase its children.
Authenticated clients can read these curated tables; anonymous access and client
writes are denied. Trusted service-role ingestion can write. Private imports
must not be copied into these shared reference tables.

### Local validation

From `supabase/`, run `npm ci --ignore-scripts` then `npm test` (Node.js 22+).
On this Windows installation use `C:\Program Files\nodejs\npm.cmd` if the
PowerShell npm launcher fails. Tests use an isolated in-memory PGlite Postgres
engine, bootstrap Supabase's standard roles, and apply all migrations in order.
They verify table/RLS creation, indexes, valid linguistic fixtures, homonyms,
ambiguous inflections, JSON checks, orphan rejection, restricted parent deletion,
and client read/write permissions. No database credentials are needed.

Passed locally on September 9, 2026. This verifies SQL against embedded Postgres;
it is not a live Supabase deployment or a complete Supabase API integration test.

Use ONE main/production Supabase project initially, per Corey's September 9, 2026 cost decision. All app environments share it. Do not provision development or preview databases. This supersedes the original card 04 acceptance criteria.

1. Connect the existing project through Supabase MCP, or use its SQL editor.
2. Apply migrations/20260909000100_app_health.sql once, then environments/production.sql. The singleton row contains only public health metadata. Anonymous/authenticated roles have SELECT only and RLS; no client writes are permitted.
3. Populate frontend/.env.local with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...). Keep APP_ENV=development for local work. The file is ignored by Git. Do not add a service-role or secret key.
4. Put the SAME URL/publishable-key values into EAS development, preview, and production environments. These are public client settings available at bundle time, including EAS Update; they are not backend secrets. EAS_BUILD profile variables do not automatically carry into EAS Update.
5. Restart Expo. On Android or web in local development (or a preview build), Account > Check connection must report Connected to production. The app build variant does not change the database target.

The check has a ten-second timeout and reports missing configuration, failed reads, wrong environment marker, or unsupported schema. Auth persistence/sign-in remains card 05. No user records are read or written by this diagnostic.

Remote project connection, SQL execution, RLS write-denial verification, EAS variable setup, and live Android/web checks are pending access/values. No live provisioning is claimed by these files.

Only URL and publishable key are needed in frontend/.env.local now. Supabase MCP uses browser OAuth for administration. Database passwords/management access are only needed if using alternative administration tools, never in frontend config. EAS is already signed in; no extra Expo API key is needed for this work.

## Card 20a: document content and reading positions

`20260910000300_document_content.sql` adds nullable metadata to existing documents:
`level` (1 Starter, 2 Beginner, 3 Developing, 4 Intermediate), `topic`,
`word_count`, `source`, `attribution`, and `license`. Null means unknown or not yet
processed; it is not silently classified as Starter or zero words. Ingestion is
responsible for computing word counts and supplying provenance.

Read `document_section` ordered by `position` (unique, zero-based, gaps allowed).
Sections have stable UUIDs and a `paragraph` or `heading` kind. Text and identity
cannot be updated: replace a section to change its body. Reordering retains its
anchors; deleting/replacing it cascades deletion of saved positions referencing it.
Consumers should fall back to the beginning when no position exists.

Upsert `reading_position` on `(user_id,document_id)` with `section_id` and
`character_offset`. User IDs are profile UUIDs. Offsets count Unicode code points
from zero within the stored body, including an end-of-section offset. JavaScript
clients must convert UTF-16 indices (e.g. use `Array.from(body)`); do not normalize
text after obtaining offsets. The database rejects offsets outside the section
and section/document mismatches and assigns `updated_at` on every save. Concurrent
saves use the last database write; offline conflict resolution is future scope.

Authenticated users read included sections and manage their own private sections.
Only the service role writes included sections. Saved positions are private to the
profile and require document access. Anonymous access is denied. No UI, content
seeding, or production migration is part of this change.

Run `node --test supabase/tests/*.test.mjs` from the repository root for embedded
checks, and `node --test supabase/tests/access.integration.mjs` against the configured
local Supabase stack for SDK checks. The content suite applies all application
migrations, excluding the Storage migration which requires real Supabase Storage.

Validation September 10, 2026: all five embedded suites and the local Supabase SDK
isolation suite passed. The migration was also applied successfully to the existing
local Docker test database. Production remains unchanged.
