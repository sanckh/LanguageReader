-- Distinguishes the one-time onboarding assessment from repeatable knowledge
-- checks so the two never mix in queries (profile, resume) or completion logic.
alter table public.assessment
  add column kind text not null default 'onboarding'
    check (kind in ('onboarding', 'knowledge_check')),
  add column focus_difficulty integer
    check (focus_difficulty between 1 and 5);
create index assessment_user_kind_idx on public.assessment (user_id, kind);
