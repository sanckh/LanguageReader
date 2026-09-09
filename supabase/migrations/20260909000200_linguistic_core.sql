-- Shared reference data; no Polish-specific columns or morphology enums.
create table public.language (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  capabilities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities) = 'object')
);

-- Homonyms may share a lemma and part of speech; identity is the UUID.
create table public.lexeme (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.language(id) on delete restrict,
  lemma text not null check (btrim(lemma) <> ''),
  part_of_speech text
);

-- One spelling can have several analyses, including for the same lexeme.
create table public.surface_form (
  id uuid primary key default gen_random_uuid(),
  lexeme_id uuid not null references public.lexeme(id) on delete restrict,
  form_text text not null check (btrim(form_text) <> ''),
  grammatical_features jsonb not null default '{}'::jsonb
    check (jsonb_typeof(grammatical_features) = 'object')
);

create table public.meaning (
  id uuid primary key default gen_random_uuid(),
  lexeme_id uuid not null references public.lexeme(id) on delete restrict,
  gloss text not null check (btrim(gloss) <> ''),
  source text
);

create table public.example_sentence (
  id uuid primary key default gen_random_uuid(),
  lexeme_id uuid not null references public.lexeme(id) on delete restrict,
  source_lang_text text not null check (btrim(source_lang_text) <> ''),
  target_lang_text text,
  source text
);

create index lexeme_language_id_idx on public.lexeme (language_id);
create index surface_form_lexeme_id_idx on public.surface_form (lexeme_id);
create index meaning_lexeme_id_idx on public.meaning (lexeme_id);
create index example_sentence_lexeme_id_idx on public.example_sentence (lexeme_id);

-- Curated reference data: authenticated readers, trusted server-side writers.
alter table public.language enable row level security;
alter table public.lexeme enable row level security;
alter table public.surface_form enable row level security;
alter table public.meaning enable row level security;
alter table public.example_sentence enable row level security;

revoke all on table public.language, public.lexeme, public.surface_form,
  public.meaning, public.example_sentence from anon, authenticated;
grant select on table public.language, public.lexeme, public.surface_form,
  public.meaning, public.example_sentence to authenticated;
grant select, insert, update, delete on table public.language, public.lexeme,
  public.surface_form, public.meaning, public.example_sentence to service_role;

create policy "Read language reference data" on public.language
  for select to authenticated using (true);
create policy "Read lexeme reference data" on public.lexeme
  for select to authenticated using (true);
create policy "Read surface form reference data" on public.surface_form
  for select to authenticated using (true);
create policy "Read meaning reference data" on public.meaning
  for select to authenticated using (true);
create policy "Read example sentence reference data" on public.example_sentence
  for select to authenticated using (true);
