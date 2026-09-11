alter table public.document
 add column provider text,
 add column provider_book_id text,
 add column authors text[] not null default '{}',
 add column translators text[] not null default '{}',
 add column source_notice text,
 add column modification_notice text,
 add column source_download_url text,
 add column content_hash text,
 add column imported_at timestamptz,
 add constraint document_provider_pair check (
  (provider is null and provider_book_id is null) or
  (provider is not null and provider_book_id is not null and btrim(provider) <> '' and btrim(provider_book_id) <> '')
 );
create unique index document_included_provider_idx on public.document(provider, provider_book_id)
 where is_included_library;

-- One transaction per book: readers see either the previous edition or the complete new one.
create function public.import_wolne_lektury_book(book jsonb, sections jsonb, refresh boolean default false)
 returns jsonb language plpgsql set search_path = '' as $$
declare
 existing public.document;
 doc_id uuid;
 language_uuid uuid;
 same_sections boolean;
 result_action text;
begin
 if jsonb_typeof(book) is distinct from 'object'
   or coalesce(book->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
   or coalesce(btrim(book->>'title'), '') = ''
   or coalesce(btrim(book->>'license'), '') = ''
   or coalesce(btrim(book->>'source_notice'), '') = ''
   or jsonb_typeof(sections) is distinct from 'array' then
  raise exception 'Invalid book payload' using errcode = '22023';
 end if;
 if jsonb_array_length(sections) = 0 or jsonb_array_length(sections) > 50000 then
  raise exception 'Invalid section count' using errcode = '22023';
 end if;
 select id into strict language_uuid from public.language where code = 'pl';
 perform pg_advisory_xact_lock(hashtextextended('wolne-lektury:' || (book->>'slug'), 0));
 select * into existing from public.document
  where is_included_library and provider = 'wolne-lektury' and provider_book_id = book->>'slug'
  for update;
 if existing.id is not null then
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'body', body) order by position), '[]'::jsonb) = sections
   into same_sections from public.document_section where document_id = existing.id;
  if not same_sections and not refresh then
   raise exception 'Source text changed; use --refresh to replace sections and reset saved positions' using errcode = '22023';
  end if;
  doc_id := existing.id;
  result_action := case when same_sections then 'unchanged' else 'refreshed' end;
 else
  insert into public.document(language_id, source_type, title, is_included_library, provider, provider_book_id)
   values(language_uuid, 'wolne-lektury', book->>'title', true, 'wolne-lektury', book->>'slug') returning id into doc_id;
  same_sections := false;
  result_action := 'imported';
 end if;
 update public.document set
  title = book->>'title', level = (book->>'level')::smallint, topic = book->>'topic',
  word_count = (book->>'word_count')::integer, source = book->>'source',
  authors = array(select jsonb_array_elements_text(book->'authors')),
  translators = array(select jsonb_array_elements_text(book->'translators')),
  attribution = book->>'attribution', license = book->>'license',
  source_notice = book->>'source_notice', modification_notice = book->>'modification_notice',
  source_download_url = book->>'source_download_url', content_hash = book->>'content_hash',
  imported_at = now(), status = 'ready'
 where id = doc_id;
 if not same_sections then
  delete from public.document_section where document_id = doc_id;
  insert into public.document_section(document_id, position, kind, body)
   select doc_id, (ordinality - 1)::integer, value->>'kind', value->>'body'
   from jsonb_array_elements(sections) with ordinality;
 end if;
 return jsonb_build_object('id', doc_id, 'action', result_action);
end;
$$;
revoke all on function public.import_wolne_lektury_book(jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_wolne_lektury_book(jsonb, jsonb, boolean) to service_role;
