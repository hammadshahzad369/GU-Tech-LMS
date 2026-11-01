begin;
insert into storage.buckets(id,name,public,file_size_limit) values('resources','resources',false,26214400),('submissions','submissions',false,26214400),('complaint-attachments','complaint-attachments',false,10485760) on conflict(id) do nothing;
create policy resource_upload on storage.objects for insert to authenticated with check(bucket_id='resources' and public.manage_course(((storage.foldername(name))[1])::uuid));
create policy resource_download on storage.objects for select to authenticated using(bucket_id='resources' and public.member(((storage.foldername(name))[1])::uuid));
create policy resource_remove on storage.objects for delete to authenticated using(bucket_id='resources' and (owner_id=auth.uid()::text or public.has_role('admin')) and public.manage_course(((storage.foldername(name))[1])::uuid));
create policy own_upload on storage.objects for insert to authenticated with check(bucket_id in ('submissions','complaint-attachments') and (storage.foldername(name))[1]=auth.uid()::text and (public.has_role('student') or public.has_role('teacher')));
create policy submission_download on storage.objects for select to authenticated using(bucket_id='submissions' and public.active_user() and ((storage.foldername(name))[1]=auth.uid()::text or public.has_role('admin') or exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.file_path=name and public.teaches(a.course_id))));
create policy complaint_download on storage.objects for select to authenticated using(bucket_id='complaint-attachments' and public.active_user() and ((storage.foldername(name))[1]=auth.uid()::text or public.has_role('admin')));
do $$begin
if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_messages' and schemaname='public') then alter publication supabase_realtime add table public.chat_messages;end if;
if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='announcements' and schemaname='public') then alter publication supabase_realtime add table public.announcements;end if;
end$$;
commit;
