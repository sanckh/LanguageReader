create unique index document_private_provider_idx on public.document(owner_id, provider, provider_book_id)
 where not is_included_library and provider is not null;

-- Copy an already imported edition atomically, preserving credits and each user's own anchors.
create function public.save_provider_book(source_id uuid, learner_id uuid)
 returns uuid language plpgsql set search_path = '' as $$
declare
 source_doc public.document;
 saved_id uuid;
begin
 select * into strict source_doc from public.document
  where id = source_id and is_included_library and status = 'ready' and provider is not null
  for share;
 perform pg_advisory_xact_lock(hashtextextended(learner_id::text || ':' || source_doc.provider || ':' || source_doc.provider_book_id, 0));
 select id into saved_id from public.document where owner_id = learner_id
  and provider = source_doc.provider and provider_book_id = source_doc.provider_book_id and not is_included_library;
 if saved_id is not null then return saved_id; end if;
 insert into public.document(owner_id, language_id, source_type, title, is_included_library, status,
  level, topic, word_count, source, attribution, license, provider, provider_book_id, authors,
  translators, source_notice, modification_notice, source_download_url, content_hash, imported_at)
 values (learner_id, source_doc.language_id, source_doc.source_type, source_doc.title, false, 'ready',
  source_doc.level, source_doc.topic, source_doc.word_count, source_doc.source, source_doc.attribution,
  source_doc.license, source_doc.provider, source_doc.provider_book_id, source_doc.authors,
  source_doc.translators, source_doc.source_notice, source_doc.modification_notice,
  source_doc.source_download_url, source_doc.content_hash, now()) returning id into saved_id;
 insert into public.document_section(document_id, position, kind, body)
  select saved_id, position, kind, body from public.document_section where document_id = source_id;
 insert into public.reader_settings(user_id, document_id, mode)
  select learner_id, saved_id, mode from public.reader_settings where user_id = learner_id and document_id = source_id;
 insert into public.reading_position(user_id, document_id, section_id, character_offset)
  select learner_id, saved_id, target.id, r.character_offset from public.reading_position r
  join public.document_section original on original.id = r.section_id
  join public.document_section target on target.document_id = saved_id and target.position = original.position
  where r.user_id = learner_id and r.document_id = source_id;
 insert into public.reader_assistance(user_id, document_id, section_id, start_offset, end_offset, attempt, revealed, translation, vocabulary_help)
  select learner_id, saved_id, target.id, a.start_offset, a.end_offset, a.attempt, a.revealed, a.translation, a.vocabulary_help
  from public.reader_assistance a
  join public.document_section original on original.id = a.section_id
  join public.document_section target on target.document_id = saved_id and target.position = original.position
  where a.user_id = learner_id and a.document_id = source_id;
 return saved_id;
end;
$$;
revoke all on function public.save_provider_book(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_provider_book(uuid, uuid) to service_role;
