alter table public.document
 add column level smallint check (level between 1 and 4),
 add column topic text check (btrim(topic) <> ''),
 add column word_count integer check (word_count >= 0),
 add column source text check (btrim(source) <> ''),
 add column attribution text check (btrim(attribution) <> ''),
 add column license text check (btrim(license) <> '');

create index document_library_level_idx on public.document(language_id, level)
 where is_included_library;

create table public.document_section (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.document(id) on delete cascade,
 position integer not null check (position >= 0),
 kind text not null check (kind in ('paragraph', 'heading')),
 body text not null check (btrim(body) <> ''),
 unique (document_id, position),
 unique (document_id, id)
);

-- An anchor is a section UUID plus a Unicode code-point offset, never a screen coordinate.
create table public.reading_position (
 user_id uuid not null references public.user_profile(id) on delete cascade,
 document_id uuid not null references public.document(id) on delete cascade,
 section_id uuid not null,
 character_offset integer not null default 0 check (character_offset >= 0),
 updated_at timestamptz not null default now(),
 primary key (user_id, document_id),
 foreign key (document_id, section_id) references public.document_section(document_id, id) on delete cascade
);
create index reading_position_section_idx on public.reading_position(document_id, section_id);

create function public.validate_reading_position() returns trigger
 language plpgsql set search_path = '' as $$
begin
 if new.character_offset > (select char_length(body) from public.document_section
   where id = new.section_id and document_id = new.document_id) then
  raise exception 'Reading offset exceeds section length' using errcode = '23514';
 end if;
 new.updated_at := clock_timestamp();
 return new;
end;
$$;
create trigger reading_position_validate before insert or update on public.reading_position
 for each row execute function public.validate_reading_position();

-- Replace a section to edit its text, invalidating its old anchors through the FK cascade.
create function public.preserve_document_section_anchor() returns trigger
 language plpgsql set search_path = '' as $$
begin
 if new.id <> old.id or new.document_id <> old.document_id or new.body <> old.body then
  raise exception 'Replace the section to change its text or identity' using errcode = '23514';
 end if;
 return new;
end;
$$;
create trigger document_section_anchor before update on public.document_section
 for each row execute function public.preserve_document_section_anchor();

alter table public.document_section enable row level security;
alter table public.reading_position enable row level security;
revoke all on public.document_section, public.reading_position from anon, authenticated;
grant select, insert, update, delete on public.document_section, public.reading_position to authenticated, service_role;

create policy document_section_read on public.document_section for select to authenticated
 using (exists (select 1 from public.document d where d.id = document_id));
create policy document_section_insert on public.document_section for insert to authenticated
 with check (exists (select 1 from public.document d where d.id = document_id and not d.is_included_library));
create policy document_section_update on public.document_section for update to authenticated
 using (exists (select 1 from public.document d where d.id = document_id and not d.is_included_library))
 with check (exists (select 1 from public.document d where d.id = document_id and not d.is_included_library));
create policy document_section_delete on public.document_section for delete to authenticated
 using (exists (select 1 from public.document d where d.id = document_id and not d.is_included_library));

create policy reading_position_owner on public.reading_position for all to authenticated
 using (exists (select 1 from public.user_profile p where p.id = user_id and p.auth_user_id = (select auth.uid()))
   and exists (select 1 from public.document d where d.id = document_id))
 with check (exists (select 1 from public.user_profile p where p.id = user_id and p.auth_user_id = (select auth.uid()))
   and exists (select 1 from public.document d where d.id = document_id));
