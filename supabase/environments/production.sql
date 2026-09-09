-- Run only in the production Supabase project; wrong existing markers fail visibly.
insert into public.app_health (id, environment, schema_version) values (1, 'production', 1);
