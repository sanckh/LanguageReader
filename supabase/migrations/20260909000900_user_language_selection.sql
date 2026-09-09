insert into public.language (code, name, capabilities)
values ('en', 'English', '{"native": true}'::jsonb)
on conflict (code) do nothing;

update public.language set capabilities = '{"learning": true}'::jsonb
where code = 'pl';

alter table public.user_profile
  add column native_language_id uuid references public.language(id) on delete restrict,
  add column learning_language_id uuid references public.language(id) on delete restrict;

create index user_profile_native_language_id_idx
  on public.user_profile (native_language_id);
create index user_profile_learning_language_id_idx
  on public.user_profile (learning_language_id);
