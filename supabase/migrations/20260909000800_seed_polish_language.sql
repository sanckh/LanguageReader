-- Onboarding assessments reference this language row via assessment.language_id.
insert into public.language (code, name)
values ('pl', 'Polish')
on conflict (code) do nothing;
