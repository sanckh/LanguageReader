# Supabase setup

Use ONE main/production Supabase project initially, per Corey's September 9, 2026 cost decision. All app environments share it. Do not provision development or preview databases. This supersedes the original card 04 acceptance criteria.

1. Connect the existing project through Supabase MCP, or use its SQL editor.
2. Apply migrations/20260909000100_app_health.sql once, then environments/production.sql. The singleton row contains only public health metadata. Anonymous/authenticated roles have SELECT only and RLS; no client writes are permitted.
3. Populate frontend/.env.local with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...). Keep APP_ENV=development for local work. The file is ignored by Git. Do not add a service-role or secret key.
4. Put the SAME URL/publishable-key values into EAS development, preview, and production environments. These are public client settings available at bundle time, including EAS Update; they are not backend secrets. EAS_BUILD profile variables do not automatically carry into EAS Update.
5. Restart Expo. On Android or web in local development (or a preview build), Account > Check connection must report Connected to production. The app build variant does not change the database target.

The check has a ten-second timeout and reports missing configuration, failed reads, wrong environment marker, or unsupported schema. Auth persistence/sign-in remains card 05. No user records are read or written by this diagnostic.

Remote project connection, SQL execution, RLS write-denial verification, EAS variable setup, and live Android/web checks are pending access/values. No live provisioning is claimed by these files.

Only URL and publishable key are needed in frontend/.env.local now. Supabase MCP uses browser OAuth for administration. Database passwords/management access are only needed if using alternative administration tools, never in frontend config. EAS is already signed in; no extra Expo API key is needed for this work.
