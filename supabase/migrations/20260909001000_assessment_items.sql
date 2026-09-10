-- Versioned assessment content. Served only through Express so the correct
-- answer never reaches the client; hence no authenticated read access.
create table public.assessment_item (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.language(id) on delete restrict,
  base_language_id uuid not null references public.language(id) on delete restrict,
  item_key text not null check (btrim(item_key) <> ''),
  version integer not null default 1 check (version >= 1),
  item_type text not null
    check (item_type in ('vocabulary_meaning', 'sentence_comprehension')),
  difficulty integer not null check (difficulty between 1 and 5),
  target_lexeme_id uuid references public.lexeme(id) on delete restrict,
  prompt text not null check (btrim(prompt) <> ''),
  options jsonb not null
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_option_key text not null check (btrim(correct_option_key) <> ''),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  active boolean not null default true,
  unique (language_id, item_key, version)
);
create index assessment_item_language_active_difficulty_idx
  on public.assessment_item (language_id, active, difficulty);
create index assessment_item_target_lexeme_id_idx
  on public.assessment_item (target_lexeme_id);

alter table public.assessment_item enable row level security;
revoke all on table public.assessment_item from anon, authenticated;
grant select, insert, update, delete on table public.assessment_item
  to service_role;

-- Retain which item and content version produced each answer, for calibration.
alter table public.assessment_response
  add column selected_option_key text,
  add column item_version integer;
