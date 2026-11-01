-- Run the WHOLE file once on an empty public schema. All changes are atomic.
begin;

-- 0001_core.sql
create extension if not exists pgcrypto;
create type public.user_role as enum ('admin','teacher','student');
create table public.profiles(id uuid primary key references auth.users on delete cascade,full_name text not null,email text unique not null,role public.user_role not null default 'student',roll_no text unique,is_active boolean not null default true,must_change_password boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.courses(id uuid primary key default gen_random_uuid(),code text unique not null,title text not null,description text,is_archived boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.course_teachers(course_id uuid references public.courses on delete cascade,teacher_id uuid references public.profiles on delete cascade,created_at timestamptz not null default now(),primary key(course_id,teacher_id));
create table public.enrollments(course_id uuid references public.courses on delete cascade,student_id uuid references public.profiles on delete cascade,enrolled_at timestamptz not null default now(),created_at timestamptz not null default now(),primary key(course_id,student_id));
create function public.active_user() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and is_active)$$;
create function public.has_role(r text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role::text=r and is_active and not must_change_password)$$;
create function public.is_enrolled(cid uuid) returns boolean language sql stable security definer set search_path=public as $$select public.has_role('student') and exists(select 1 from enrollments where course_id=cid and student_id=auth.uid())$$;
create function public.teaches(cid uuid) returns boolean language sql stable security definer set search_path=public as $$select public.has_role('teacher') and exists(select 1 from course_teachers where course_id=cid and teacher_id=auth.uid())$$;
create function public.member(cid uuid) returns boolean language sql stable security definer set search_path=public as $$select public.has_role('admin') or public.teaches(cid) or public.is_enrolled(cid)$$;
create function public.manage_course(cid uuid) returns boolean language sql stable security definer set search_path=public as $$select public.has_role('admin') or public.teaches(cid)$$;
create function public.touch_updated() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end$$;
create trigger touch_profile before update on public.profiles for each row execute function public.touch_updated();
create trigger touch_course before update on public.courses for each row execute function public.touch_updated();
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_teachers enable row level security;
alter table public.enrollments enable row level security;
create policy profile_read on public.profiles for select to authenticated using(public.active_user() and (id=auth.uid() or public.has_role('admin') or exists(select 1 from public.enrollments e where e.student_id=profiles.id and public.teaches(e.course_id)) or (not must_change_password and exists(select 1 from public.course_teachers t where t.teacher_id=profiles.id and public.member(t.course_id)))));
create policy courses_read on public.courses for select to authenticated using(public.member(id));
create policy courses_admin on public.courses for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy teachers_read on public.course_teachers for select to authenticated using(public.member(course_id));
create policy teachers_admin on public.course_teachers for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy enrollments_read on public.enrollments for select to authenticated using(public.manage_course(course_id) or (student_id=auth.uid() and public.is_enrolled(course_id)));
create policy enrollments_admin on public.enrollments for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create index on public.enrollments(student_id);

-- 0002_content.sql
create table public.resources(id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses on delete cascade,uploaded_by uuid not null references public.profiles,title text not null,description text,file_path text not null,file_name text not null,mime_type text not null,size_bytes bigint not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.assignments(id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses on delete cascade,created_by uuid not null references public.profiles,title text not null,instructions text not null,max_marks numeric(6,2) not null check(max_marks>0),due_at timestamptz not null,allow_late boolean not null default false,attachment_path text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.submissions(id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.assignments on delete cascade,student_id uuid not null references public.profiles,text_answer text,file_path text,submitted_at timestamptz not null default now(),is_late boolean not null default false,marks_obtained numeric(6,2),feedback text,graded_by uuid references public.profiles,graded_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(assignment_id,student_id));
create table public.quizzes(id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses on delete cascade,created_by uuid not null references public.profiles,title text not null,description text,time_limit_minutes int not null check(time_limit_minutes>0),opens_at timestamptz not null,closes_at timestamptz not null,is_published boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(closes_at>opens_at));
create type public.question_type as enum ('mcq_single','mcq_multi','true_false');
create table public.quiz_questions(id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes on delete cascade,position int not null,type public.question_type not null,prompt text not null,options jsonb not null,marks numeric(5,2) not null default 1 check(marks>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.quiz_answers(question_id uuid primary key references public.quiz_questions on delete cascade,correct_option_ids text[] not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes on delete cascade,student_id uuid not null references public.profiles,started_at timestamptz not null default now(),submitted_at timestamptz,answers jsonb not null default '{}',score numeric(6,2),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(quiz_id,student_id));
create table public.announcements(id uuid primary key default gen_random_uuid(),course_id uuid references public.courses on delete cascade,author_id uuid not null references public.profiles,title text not null,body text not null,is_pinned boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.announcement_reads(user_id uuid references public.profiles on delete cascade,announcement_id uuid references public.announcements on delete cascade,read_at timestamptz not null default now(),created_at timestamptz not null default now(),primary key(user_id,announcement_id));
create table public.chat_messages(id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses on delete cascade,sender_id uuid not null references public.profiles,sender_name text not null,sender_role text not null,body text not null check(char_length(body) between 1 and 2000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz);
create type public.complaint_status as enum ('open','in_review','resolved','rejected');
create table public.complaints(id uuid primary key default gen_random_uuid(),raised_by uuid not null references public.profiles,course_id uuid references public.courses,category text not null,subject text not null,description text not null,attachment_path text,status public.complaint_status not null default 'open',admin_response text,resolved_by uuid references public.profiles,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.audit_log(id bigint generated always as identity primary key,actor_id uuid references public.profiles,action text not null,entity text not null,entity_id uuid,at timestamptz not null default now(),created_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['resources','assignments','submissions','quizzes','quiz_questions','quiz_answers','quiz_attempts','announcements','announcement_reads','chat_messages','complaints','audit_log'] loop execute format('alter table public.%I enable row level security',t); if t not in ('announcement_reads','audit_log') then execute format('create trigger touch_row before update on public.%I for each row execute function public.touch_updated()',t);end if;end loop;end$$;
create policy resources_read on public.resources for select to authenticated using(public.member(course_id));
create policy resources_insert on public.resources for insert to authenticated with check(public.manage_course(course_id) and uploaded_by=auth.uid());
create policy resources_delete on public.resources for delete to authenticated using(public.has_role('admin') or (uploaded_by=auth.uid() and public.teaches(course_id)));
create policy assignments_read on public.assignments for select to authenticated using(public.member(course_id));
create policy assignments_write on public.assignments for all to authenticated using(public.manage_course(course_id)) with check(public.manage_course(course_id));
create policy submissions_read on public.submissions for select to authenticated using(exists(select 1 from public.assignments a where a.id=assignment_id and (public.manage_course(a.course_id) or (student_id=auth.uid() and public.is_enrolled(a.course_id)))));
-- Submissions, grades and quiz attempts are mutated only by checked database functions.
create policy quizzes_read on public.quizzes for select to authenticated using(public.manage_course(course_id) or (is_published and public.is_enrolled(course_id)));
create policy questions_read on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and (public.manage_course(q.course_id) or (q.is_published and public.is_enrolled(q.course_id) and exists(select 1 from public.quiz_attempts a where a.quiz_id=q.id and a.student_id=auth.uid())))));
create policy answers_teacher_only on public.quiz_answers for select to authenticated using(exists(select 1 from public.quiz_questions qq join public.quizzes q on q.id=qq.quiz_id where qq.id=question_id and public.manage_course(q.course_id)));
create policy attempts_read on public.quiz_attempts for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and (public.manage_course(q.course_id) or (student_id=auth.uid() and public.is_enrolled(q.course_id)))));
create policy announcements_read on public.announcements for select to authenticated using((public.has_role('admin') or public.has_role('teacher') or public.has_role('student')) and (course_id is null or public.member(course_id)));
create policy announcements_insert on public.announcements for insert to authenticated with check(author_id=auth.uid() and (public.has_role('admin') or (course_id is not null and public.teaches(course_id))));
create policy announcements_update on public.announcements for update to authenticated using(public.has_role('admin') or (author_id=auth.uid() and public.teaches(course_id))) with check(public.has_role('admin') or (author_id=auth.uid() and public.teaches(course_id)));
create policy announcements_delete on public.announcements for delete to authenticated using(public.has_role('admin') or (author_id=auth.uid() and public.teaches(course_id)));
create policy reads_self on public.announcement_reads for all to authenticated using(user_id=auth.uid() and public.active_user()) with check(user_id=auth.uid() and public.active_user() and exists(select 1 from public.announcements a where a.id=announcement_id));
create policy messages_read on public.chat_messages for select to authenticated using(public.member(course_id));
create policy messages_insert on public.chat_messages for insert to authenticated with check(public.member(course_id) and sender_id=auth.uid() and not public.has_role('admin') and sender_name=(select full_name from public.profiles where id=auth.uid()) and sender_role=(select role::text from public.profiles where id=auth.uid()));
create policy complaints_read on public.complaints for select to authenticated using(public.has_role('admin') or (raised_by=auth.uid() and (public.has_role('teacher') or public.has_role('student'))));
create policy complaints_insert on public.complaints for insert to authenticated with check(raised_by=auth.uid() and (public.has_role('teacher') or public.has_role('student')) and status='open' and admin_response is null and resolved_by is null and (course_id is null or public.member(course_id)));
create policy audit_admin on public.audit_log for select to authenticated using(public.has_role('admin'));
create index on public.resources(course_id,created_at desc);
create index on public.assignments(course_id,due_at);
create index on public.submissions(assignment_id);
create index on public.quiz_attempts(quiz_id);
create index on public.announcements(course_id,created_at desc);
create index on public.chat_messages(course_id,created_at desc);
create index on public.complaints(status,created_at desc);
create view public.v_student_marks with(security_invoker=true) as
select s.student_id,a.course_id,'assignment'::text kind,a.id item_id,a.title,s.marks_obtained obtained,a.max_marks max,s.graded_at from public.submissions s join public.assignments a on a.id=s.assignment_id
union all select qa.student_id,q.course_id,'quiz',q.id,q.title,qa.score,(select coalesce(sum(marks),0) from public.quiz_questions where quiz_id=q.id),qa.submitted_at from public.quiz_attempts qa join public.quizzes q on q.id=qa.quiz_id;

-- 0003_actions.sql
create function public.submit_assignment(aid uuid,answer text,filepath text default null) returns public.submissions language plpgsql security definer set search_path=public as $$declare a assignments; s submissions;begin
select * into a from assignments where id=aid for share;
if not found or not is_enrolled(a.course_id) then raise exception 'FORBIDDEN';end if;
if now()>a.due_at and not a.allow_late then raise exception 'DEADLINE_PASSED';end if;
if coalesce(length(trim(answer)),0)=0 and filepath is null then raise exception 'ANSWER_REQUIRED';end if;
if filepath is not null and filepath not like auth.uid()::text||'/%' then raise exception 'FORBIDDEN';end if;
insert into submissions(assignment_id,student_id,text_answer,file_path,is_late) values(aid,auth.uid(),answer,filepath,now()>a.due_at) on conflict(assignment_id,student_id) do update set text_answer=excluded.text_answer,file_path=excluded.file_path,is_late=excluded.is_late,submitted_at=now(),marks_obtained=null,feedback=null,graded_by=null,graded_at=null returning * into s;return s;end$$;
create function public.grade_submission(sid uuid,marks numeric,note text) returns public.submissions language plpgsql security definer set search_path=public as $$declare s submissions;a assignments;begin
select * into s from submissions where id=sid for update;select * into a from assignments where id=s.assignment_id;
if not found or not manage_course(a.course_id) then raise exception 'FORBIDDEN';end if;
if marks<0 or marks>a.max_marks then raise exception 'INVALID_MARKS';end if;
update submissions set marks_obtained=marks,feedback=note,graded_by=auth.uid(),graded_at=now() where id=sid returning * into s;
insert into audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'grade','submission',sid);return s;end$$;
create function public.save_quiz(payload jsonb,qid uuid default null) returns uuid language plpgsql security definer set search_path=public as $$declare cid uuid;result uuid;question jsonb;qqid uuid;old quizzes;begin
if qid is null then cid=(payload->>'course_id')::uuid;else select * into old from quizzes where id=qid for update;cid=old.course_id;end if;
if cid is null or not manage_course(cid) then raise exception 'FORBIDDEN';end if;
if qid is not null and exists(select 1 from quiz_attempts where quiz_id=qid) then raise exception 'ATTEMPT_EXISTS';end if;
if qid is null then
insert into quizzes(course_id,created_by,title,description,time_limit_minutes,opens_at,closes_at,is_published) values(cid,auth.uid(),payload->>'title',payload->>'description',(payload->>'time_limit_minutes')::int,(payload->>'opens_at')::timestamptz,(payload->>'closes_at')::timestamptz,coalesce((payload->>'is_published')::boolean,false)) returning id into result;
else result=qid;update quizzes set title=coalesce(payload->>'title',title),description=coalesce(payload->>'description',description),time_limit_minutes=coalesce((payload->>'time_limit_minutes')::int,time_limit_minutes),opens_at=coalesce((payload->>'opens_at')::timestamptz,opens_at),closes_at=coalesce((payload->>'closes_at')::timestamptz,closes_at),is_published=coalesce((payload->>'is_published')::boolean,is_published) where id=qid;end if;
if payload ? 'questions' then
if jsonb_array_length(payload->'questions')<1 then raise exception 'QUESTIONS_REQUIRED';end if;
delete from quiz_questions where quiz_id=result;
for question in select value from jsonb_array_elements(payload->'questions') loop
insert into quiz_questions(quiz_id,position,type,prompt,options,marks) values(result,(question->>'position')::int,(question->>'type')::question_type,question->>'prompt',question->'options',(question->>'marks')::numeric) returning id into qqid;
insert into quiz_answers(question_id,correct_option_ids) values(qqid,array(select jsonb_array_elements_text(question->'correct_option_ids')));
end loop;end if;
if (select is_published from quizzes where id=result) and not exists(select 1 from quiz_questions where quiz_id=result) then raise exception 'QUESTIONS_REQUIRED';end if;
return result;end$$;
create function public.start_quiz(qid uuid) returns public.quiz_attempts language plpgsql security definer set search_path=public as $$declare q quizzes;a quiz_attempts;begin
select * into q from quizzes where id=qid for update;
if not found or not is_enrolled(q.course_id) or not q.is_published then raise exception 'FORBIDDEN';end if;
if now()<q.opens_at or now()>=q.closes_at then raise exception 'QUIZ_CLOSED';end if;
select * into a from quiz_attempts where quiz_id=qid and student_id=auth.uid();
if found then
if a.submitted_at is not null then raise exception 'ATTEMPT_EXISTS';end if;
return a;end if;
insert into quiz_attempts(quiz_id,student_id) values(qid,auth.uid()) returning * into a;return a;end$$;
create function public.finish_quiz(qid uuid,given jsonb) returns public.quiz_attempts language plpgsql security definer set search_path=public as $$declare q quizzes;a quiz_attempts;points numeric:=0;begin
select * into q from quizzes where id=qid;
if not found or not is_enrolled(q.course_id) then raise exception 'FORBIDDEN';end if;
select * into a from quiz_attempts where quiz_id=qid and student_id=auth.uid() for update;
if not found then raise exception 'ATTEMPT_REQUIRED';end if;
if a.submitted_at is not null then raise exception 'ATTEMPT_EXISTS';end if;
if now()>least(a.started_at+make_interval(mins=>q.time_limit_minutes),q.closes_at)+interval '10 seconds' then raise exception 'QUIZ_EXPIRED';end if;
select coalesce(sum(qq.marks),0) into points from quiz_questions qq join quiz_answers ka on ka.question_id=qq.id where qq.quiz_id=qid and (select array_agg(distinct x order by x) from jsonb_array_elements_text(coalesce(given->qq.id::text,'[]')) x)=(select array_agg(distinct x order by x) from unnest(ka.correct_option_ids) x);
update quiz_attempts set answers=given,score=points,submitted_at=now() where id=a.id returning * into a;return a;end$$;
create function public.delete_message(mid uuid) returns void language plpgsql security definer set search_path=public as $$declare m chat_messages;begin
select * into m from chat_messages where id=mid;
if not found or not member(m.course_id) or not(manage_course(m.course_id) or (m.sender_id=auth.uid() and now()<=m.created_at+interval '5 minutes')) then raise exception 'FORBIDDEN';end if;
update chat_messages set body='[Message deleted]',deleted_at=now() where id=mid;
insert into audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'delete','chat_message',mid);end$$;
create function public.resolve_complaint(cid uuid,next_status public.complaint_status,response text) returns public.complaints language plpgsql security definer set search_path=public as $$declare c complaints;begin
if not has_role('admin') then raise exception 'FORBIDDEN';end if;
select * into c from complaints where id=cid for update;
if not found then raise exception 'NOT_FOUND';end if;
if not ((c.status='open' and next_status='in_review') or (c.status='in_review' and next_status in ('resolved','rejected'))) then raise exception 'INVALID_TRANSITION';end if;
if next_status in ('resolved','rejected') and coalesce(length(trim(response)),0)=0 then raise exception 'RESPONSE_REQUIRED';end if;
update complaints set status=next_status,admin_response=response,resolved_by=auth.uid() where id=cid returning * into c;
insert into audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'status:'||next_status::text,'complaint',cid);return c;end$$;
create function public.replace_teachers(cid uuid,teachers uuid[]) returns void language plpgsql security definer set search_path=public as $$begin
if not has_role('admin') then raise exception 'FORBIDDEN';end if;
if exists(select 1 from unnest(teachers) t where not exists(select 1 from profiles where id=t and role='teacher' and is_active)) then raise exception 'INVALID_TEACHER';end if;
delete from course_teachers where course_id=cid;insert into course_teachers(course_id,teacher_id) select cid,unnest(teachers);end$$;
create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$begin
insert into audit_log(actor_id,action,entity,entity_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,case when TG_OP='DELETE' then old.id else new.id end);return coalesce(new,old);end$$;
create trigger audit_profiles after insert or update on public.profiles for each row execute function public.audit_change();
create trigger audit_resources after delete on public.resources for each row execute function public.audit_change();
create trigger audit_assignments after delete on public.assignments for each row execute function public.audit_change();
-- Functions have explicit authentication/authorization and cannot be called anonymously.
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated,service_role;
grant usage on schema public to authenticated,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
grant usage,select on all sequences in schema public to authenticated,service_role;

-- 0004_storage_realtime.sql
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

-- 0005_reporting.sql
create function public.marks_summary(cid uuid default null) returns table(student_id uuid,course_id uuid,student_name text,obtained numeric,maximum numeric,graded_items bigint) language plpgsql stable security invoker set search_path=public as $$begin
if not has_role('student') and not (cid is not null and manage_course(cid)) then raise exception 'FORBIDDEN';end if;
return query select m.student_id,m.course_id,p.full_name,coalesce(sum(m.obtained) filter(where m.obtained is not null),0),coalesce(sum(m.max) filter(where m.obtained is not null),0),count(*) filter(where m.obtained is not null) from v_student_marks m join profiles p on p.id=m.student_id where (cid is null or m.course_id=cid) group by m.student_id,m.course_id,p.full_name;
end$$;
create function public.log_admin_action(action_name text,target_id uuid) returns void language plpgsql security definer set search_path=public as $$begin
if not has_role('admin') then raise exception 'FORBIDDEN';end if;
insert into audit_log(actor_id,action,entity,entity_id) values(auth.uid(),action_name,'profiles',target_id);end$$;
create trigger audit_announcements after delete on public.announcements for each row execute function public.audit_change();
revoke execute on function public.marks_summary(uuid),public.log_admin_action(text,uuid) from public,anon;
grant execute on function public.marks_summary(uuid),public.log_admin_action(text,uuid) to authenticated,service_role;

commit;
