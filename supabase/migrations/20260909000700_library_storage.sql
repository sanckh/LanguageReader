-- Supabase supplies storage schema, RLS, table grants and helper functions.
-- Fail on existing bucket names so an unexpected public bucket is never accepted.
insert into storage.buckets (id, name, public)
 values ('my-library', 'my-library', false), ('included-library', 'included-library', false);

-- Paths use Auth UUIDs, unlike relational user_id columns (profile UUIDs).
create policy my_library_read on storage.objects for select to authenticated
 using (bucket_id = 'my-library' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy my_library_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'my-library' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy my_library_update on storage.objects for update to authenticated
 using (bucket_id = 'my-library' and (storage.foldername(name))[1] = (select auth.uid())::text)
 with check (bucket_id = 'my-library' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy my_library_delete on storage.objects for delete to authenticated
 using (bucket_id = 'my-library' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy included_library_read on storage.objects for select to authenticated
 using (bucket_id = 'included-library');
-- Included writes are service-role only (Supabase service_role bypasses RLS).

