-- Grammar/case questions ("what case is X?", "which form fits?") test Polish's
-- core inflection difficulty. They render like any other { prompt, options }
-- item, so only the item_type check needs widening.
alter table public.assessment_item
  drop constraint assessment_item_item_type_check;
alter table public.assessment_item
  add constraint assessment_item_item_type_check
  check (
    item_type in ('vocabulary_meaning', 'sentence_comprehension', 'grammar_form')
  );
