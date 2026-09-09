create table public.document (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references public.user_profile(id),
 language_id uuid not null references public.language(id),
 source_type text not null check (btrim(source_type) <> ''),
 title text not null check (btrim(title) <> ''),
 is_included_library boolean not null default false,
 status text not null default 'pending' check (btrim(status) <> ''),
 check (is_included_library = (owner_id is null))
);
create index document_owner_id_idx on public.document(owner_id);
create index document_language_id_idx on public.document(language_id);
create table public.document_lexeme_freq (
 document_id uuid not null references public.document(id),
 lexeme_id uuid not null references public.lexeme(id),
 frequency integer not null check (frequency > 0),
 primary key (document_id, lexeme_id)
);
create index document_lexeme_freq_lexeme_id_idx on public.document_lexeme_freq(lexeme_id);
create table public.reading_session (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profile(id),
 document_id uuid not null references public.document(id),
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 words_read integer not null default 0 check (words_read >= 0),
 lookups integer not null default 0 check (lookups >= 0),
 check (ended_at is null or ended_at >= started_at)
);
alter table public.surface_form add constraint surface_form_id_lexeme_unique unique (id, lexeme_id);
create table public.word_lookup_event (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profile(id),
 document_id uuid not null references public.document(id),
 lexeme_id uuid not null references public.lexeme(id),
 surface_form_id uuid,
 sentence_context text,
 created_at timestamptz not null default now(),
 foreign key (surface_form_id, lexeme_id) references public.surface_form(id, lexeme_id)
);
create index word_lookup_event_lexeme_id_idx on public.word_lookup_event(lexeme_id);
create index word_lookup_event_surface_form_id_idx on public.word_lookup_event(surface_form_id);
create table public.sentence_assistance_event (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profile(id),
 document_id uuid not null references public.document(id),
 sentence_text text not null check (btrim(sentence_text) <> ''),
 step_reached integer not null check (step_reached between 1 and 5),
 created_at timestamptz not null default now()
);
create table public.review_item (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profile(id),
 lexeme_id uuid not null references public.lexeme(id),
 due_at timestamptz not null default now(),
 strength numeric not null default 0 check (strength >= 0 and strength < 'Infinity'::numeric)
);
create index review_item_user_due_idx on public.review_item(user_id, due_at);
create index review_item_lexeme_id_idx on public.review_item(lexeme_id);
create index reading_session_user_id_idx on public.reading_session(user_id);
create index reading_session_document_id_idx on public.reading_session(document_id);
create index word_lookup_event_user_id_idx on public.word_lookup_event(user_id);
create index word_lookup_event_document_id_idx on public.word_lookup_event(document_id);
create index sentence_assistance_event_user_id_idx on public.sentence_assistance_event(user_id);
create index sentence_assistance_event_document_id_idx on public.sentence_assistance_event(document_id);

-- Fail closed until card 10 adds client ownership policies.
alter table public.document enable row level security;
revoke all on table public.document from anon, authenticated;
grant select, insert, update, delete on table public.document to service_role;
alter table public.document_lexeme_freq enable row level security;
revoke all on table public.document_lexeme_freq from anon, authenticated;
grant select, insert, update, delete on table public.document_lexeme_freq to service_role;
alter table public.reading_session enable row level security;
revoke all on table public.reading_session from anon, authenticated;
grant select, insert, update, delete on table public.reading_session to service_role;
alter table public.word_lookup_event enable row level security;
revoke all on table public.word_lookup_event from anon, authenticated;
grant select, insert, update, delete on table public.word_lookup_event to service_role;
alter table public.sentence_assistance_event enable row level security;
revoke all on table public.sentence_assistance_event from anon, authenticated;
grant select, insert, update, delete on table public.sentence_assistance_event to service_role;
alter table public.review_item enable row level security;
revoke all on table public.review_item from anon, authenticated;
grant select, insert, update, delete on table public.review_item to service_role;

