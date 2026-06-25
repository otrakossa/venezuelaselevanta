
drop policy if exists "report-media anon insert" on storage.objects;
create policy "report-media anon insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'report-media');

drop policy if exists "report-media public read" on storage.objects;
create policy "report-media public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'report-media');
