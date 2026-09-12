create table public.reader_settings (
 user_id uuid not null references public.user_profile(id) on delete cascade,
 document_id uuid not null references public.document(id) on delete cascade,
 mode text not null default 'reading' check (mode in ('reading', 'learning')),
 primary key (user_id, document_id)
);

create table public.reader_assistance (
 user_id uuid not null references public.user_profile(id) on delete cascade,
 document_id uuid not null references public.document(id) on delete cascade,
 section_id uuid not null,
 start_offset integer not null check (start_offset >= 0),
 end_offset integer not null check (end_offset > start_offset),
 attempt text not null default '' check (char_length(attempt) <= 1000),
 revealed boolean not null default false,
 translation text check (char_length(translation) <= 20000),
 vocabulary_help jsonb not null default '{}' check (jsonb_typeof(vocabulary_help) = 'object'),
 primary key (user_id, document_id, section_id, start_offset, end_offset),
 foreign key (document_id, section_id) references public.document_section(document_id, id) on delete cascade
);
create index reader_settings_document_idx on public.reader_settings(document_id);
create index reader_assistance_section_idx on public.reader_assistance(document_id, section_id);
create function public.validate_reader_assistance() returns trigger
 language plpgsql set search_path = '' as $$
begin
 if new.end_offset > (select char_length(body) from public.document_section
   where id = new.section_id and document_id = new.document_id) then
  raise exception 'Assistance range exceeds section length' using errcode = '23514';
 end if;
 return new;
end;
$$;
create trigger reader_assistance_validate before insert or update on public.reader_assistance
 for each row execute function public.validate_reader_assistance();

alter table public.reader_settings enable row level security;
alter table public.reader_assistance enable row level security;
revoke all on public.reader_settings, public.reader_assistance from anon, authenticated;
grant select, insert, update, delete on public.reader_settings, public.reader_assistance to authenticated, service_role;
create policy reader_settings_owner on public.reader_settings for all to authenticated
 using (exists (select 1 from public.user_profile p where p.id = user_id and p.auth_user_id = (select auth.uid()))
   and exists (select 1 from public.document d where d.id = document_id))
 with check (exists (select 1 from public.user_profile p where p.id = user_id and p.auth_user_id = (select auth.uid()))
   and exists (select 1 from public.document d where d.id = document_id));
create policy reader_assistance_owner on public.reader_assistance for all to authenticated
 using (exists (select 1 from public.user_profile p where p.id = user_id and p.auth_user_id = (select auth.uid()))
   and exists (select 1 from public.document d where d.id = document_id))
 with check (exists (select 1 from public.user_profile p where p.id = user_id and p.auth_user_id = (select auth.uid()))
   and exists (select 1 from public.document d where d.id = document_id));
