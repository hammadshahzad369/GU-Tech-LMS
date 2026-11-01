begin;
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
commit;
