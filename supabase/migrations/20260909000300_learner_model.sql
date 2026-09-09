-- Application user_id/owner_id references user_profile.id, not auth.users.id.
create table public.user_profile (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null unique references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.lexeme add constraint lexeme_id_language_unique unique (id, language_id);
create table public.knowledge_confidence (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_profile(id),
 language_id uuid not null references public.language(id),
 lexeme_id uuid not null,
 confidence numeric not null default 0 check (confidence between 0 and 100),
 updated_at timestamptz not null default now(),
 unique (user_id, language_id, lexeme_id),
 foreign key (lexeme_id, language_id) references public.lexeme(id, language_id)
);
create index knowledge_confidence_language_id_idx on public.knowledge_confidence(language_id);
create index knowledge_confidence_lexeme_id_idx on public.knowledge_confidence(lexeme_id);
create table public.evidence_log (
 id uuid primary key default gen_random_uuid(),
 knowledge_confidence_id uuid not null references public.knowledge_confidence(id),
 event_type text not null check (btrim(event_type) <> ''),
 delta numeric not null check (delta between -100 and 100),
 created_at timestamptz not null default now()
);
create index evidence_log_knowledge_confidence_id_idx on public.evidence_log(knowledge_confidence_id);
create function public.reject_evidence_mutation() returns trigger
 language plpgsql set search_path = '' as $$
begin
 raise exception 'evidence_log is append-only' using errcode = '55000';
end;
$$;
create trigger evidence_log_append_only before update or delete or truncate
 on public.evidence_log for each statement execute function public.reject_evidence_mutation();
revoke all on function public.reject_evidence_mutation() from public;
create function public.touch_knowledge_confidence() returns trigger
 language plpgsql set search_path = '' as $$
begin
 new.updated_at := clock_timestamp();
 return new;
end;
$$;
create trigger knowledge_confidence_updated_at before update on public.knowledge_confidence
 for each row execute function public.touch_knowledge_confidence();
revoke all on function public.touch_knowledge_confidence() from public;

-- Fail closed until card 10 adds client ownership policies.
alter table public.user_profile enable row level security;
revoke all on table public.user_profile from anon, authenticated;
grant select, insert, update, delete on table public.user_profile to service_role;
alter table public.knowledge_confidence enable row level security;
revoke all on table public.knowledge_confidence from anon, authenticated;
grant select, insert, update, delete on table public.knowledge_confidence to service_role;
alter table public.evidence_log enable row level security;
revoke all on table public.evidence_log from anon, authenticated;
grant select, insert on table public.evidence_log to service_role;

