create table public.assessment (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profile(id),
 language_id uuid not null references public.language(id),
 status text not null default 'in_progress'
   check (status in ('in_progress', 'completed', 'abandoned')),
 completed_at timestamptz,
 check ((status = 'completed') = (completed_at is not null))
);
create index assessment_user_id_idx on public.assessment(user_id);
create index assessment_language_id_idx on public.assessment(language_id);
create table public.assessment_response (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.assessment(id),
 -- Opaque question-bank identifier: the draft does not define an item table.
 item_id text not null check (btrim(item_id) <> ''),
 correct boolean not null,
 -- Snapshot on submission, not a join to mutable question-bank difficulty.
 difficulty_at_time numeric not null
   check (difficulty_at_time > '-Infinity'::numeric and difficulty_at_time < 'Infinity'::numeric)
);
create index assessment_response_assessment_id_idx on public.assessment_response(assessment_id);

-- Fail closed until card 10 adds client ownership policies.
alter table public.assessment enable row level security;
revoke all on table public.assessment from anon, authenticated;
grant select, insert, update, delete on table public.assessment to service_role;
alter table public.assessment_response enable row level security;
revoke all on table public.assessment_response from anon, authenticated;
grant select, insert, update, delete on table public.assessment_response to service_role;

