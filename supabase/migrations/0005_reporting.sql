begin;
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
