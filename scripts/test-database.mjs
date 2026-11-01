import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
let passed = 0;
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
);
await db.exec(
  `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;create publication supabase_realtime;`,
);
for (const f of [
  '0001_core.sql',
  '0002_content.sql',
  '0003_actions.sql',
  '0004_storage_realtime.sql',
  '0005_reporting.sql',
]) {
  let sql = await readFile(new URL('../supabase/migrations/' + f, import.meta.url), 'utf8');
  sql = sql.replace(
    'create extension if not exists pgcrypto;',
    '-- Built-in gen_random_uuid; PGlite has no pgcrypto package.',
  );
  await db.exec(sql);
  console.log('PASS migration', f);
  passed++;
}
const admin = '10000000-0000-4000-8000-000000000001',
  teacher = '10000000-0000-4000-8000-000000000002',
  student = '10000000-0000-4000-8000-000000000003',
  other = '10000000-0000-4000-8000-000000000004',
  outsider = '10000000-0000-4000-8000-000000000005';
const course = '20000000-0000-4000-8000-000000000001',
  assignment = '30000000-0000-4000-8000-000000000001';
await db.exec(
  `insert into auth.users values('${admin}'),('${teacher}'),('${student}'),('${other}'),('${outsider}');insert into profiles(id,full_name,email,role,must_change_password) values('${admin}','Admin','a@test.dev','admin',false),('${teacher}','Teacher','t@test.dev','teacher',false),('${student}','Student','s@test.dev','student',false),('${other}','Other','o@test.dev','student',false),('${outsider}','Outsider','x@test.dev','teacher',false);insert into courses(id,code,title) values('${course}','CS101','Computing');insert into course_teachers values('${course}','${teacher}',now());insert into enrollments(course_id,student_id) values('${course}','${student}'),('${course}','${other}');insert into assignments(id,course_id,created_by,title,instructions,max_marks,due_at) values('${assignment}','${course}','${teacher}','Essay','Write',20,now()+interval '1 day');`,
);
const as = async (id, fn) => {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
};
const ok = (name) => {
  passed++;
  console.log('PASS', name);
};
const denied = async (fn, pattern) => {
  await assert.rejects(fn, (e) => pattern.test(e.message));
};
let sid;
await as(student, async () => {
  const r = await db.query('select * from public.submit_assignment($1,$2)', [
    assignment,
    'My original answer',
  ]);
  sid = r.rows[0].id;
  assert.equal(r.rows[0].marks_obtained, null);
  ok('student submits own assignment');
});
await as(other, async () => {
  assert.equal((await db.query('select * from submissions where id=$1', [sid])).rows.length, 0);
  ok('other student cannot read submission');
});
await as(outsider, async () => {
  await denied(
    () => db.query('select public.grade_submission($1,20,$2)', [sid, 'bad']),
    /FORBIDDEN/,
  );
  ok('unassigned teacher cannot grade');
});
await as(teacher, async () => {
  await denied(
    () => db.query('select public.grade_submission($1,21,$2)', [sid, 'too high']),
    /INVALID_MARKS/,
  );
  ok('over-maximum grade rejected');
  const r = await db.query('select * from public.grade_submission($1,16,$2)', [sid, 'Good work']);
  assert.equal(Number(r.rows[0].marks_obtained), 16);
  ok('assigned teacher grades');
});
await as(student, async () => {
  assert.equal(Number((await db.query('select * from v_student_marks')).rows[0].obtained), 16);
  await db.query('select public.submit_assignment($1,$2)', [assignment, 'Replacement answer']);
  assert.equal(
    (await db.query('select * from submissions where id=$1', [sid])).rows[0].marks_obtained,
    null,
  );
  ok('resubmission clears grade');
  const changed = await db.query(
    'update submissions set marks_obtained=20 where id=$1 returning *',
    [sid],
  );
  assert.equal(changed.rows.length, 0);
  assert.equal(
    (await db.query('select * from submissions where id=$1', [sid])).rows[0].marks_obtained,
    null,
  );
  ok('direct student grade mutation blocked');
});
await db.query(`update assignments set due_at=now()-interval '1 hour' where id=$1`, [assignment]);
await as(student, async () => {
  await denied(() => db.query('select submit_assignment($1,$2)', [assignment, 'late']), /DEADLINE/);
  ok('late work blocked by server time');
});
let qid;
await as(teacher, async () => {
  const payload = {
    course_id: course,
    title: 'Quiz',
    time_limit_minutes: 5,
    opens_at: new Date(Date.now() - 60000).toISOString(),
    closes_at: new Date(Date.now() + 3600000).toISOString(),
    is_published: true,
    questions: [
      {
        position: 0,
        type: 'mcq_single',
        prompt: '2 + 2?',
        options: [
          { id: 'a', text: '4' },
          { id: 'b', text: '5' },
        ],
        marks: 5,
        correct_option_ids: ['a'],
      },
      {
        position: 1,
        type: 'mcq_multi',
        prompt: 'Even?',
        options: [
          { id: 'a', text: '2' },
          { id: 'b', text: '4' },
          { id: 'c', text: '5' },
        ],
        marks: 5,
        correct_option_ids: ['a', 'b'],
      },
    ],
  };
  qid = (await db.query('select save_quiz($1::jsonb) id', [JSON.stringify(payload)])).rows[0].id;
  ok('teacher creates quiz atomically');
});
await as(student, async () => {
  assert.equal((await db.query('select * from quiz_answers')).rows.length, 0);
  ok('answer keys hidden from direct student SQL');
  const r = await db.query('select * from start_quiz($1)', [qid]);
  assert.equal(r.rows[0].student_id, student);
  const qq = (await db.query('select * from quiz_questions order by position')).rows;
  assert.equal(qq.length, 2);
  const result = await db.query('select * from finish_quiz($1,$2::jsonb)', [
    qid,
    JSON.stringify({ [qq[0].id]: ['a'], [qq[1].id]: ['a'] }),
  ]);
  assert.equal(Number(result.rows[0].score), 5);
  ok('server quiz scoring is all-or-nothing per question');
  await denied(() => db.query('select start_quiz($1)', [qid]), /ATTEMPT_EXISTS/);
  ok('second quiz attempt rejected');
});
let complaint;
await as(student, async () => {
  complaint = (
    await db.query(
      `insert into complaints(raised_by,category,subject,description) values(auth.uid(),'technical','Login issue','Cannot access one resource') returning id`,
    )
  ).rows[0].id;
});
await as(other, async () => {
  assert.equal(
    (await db.query('select * from complaints where id=$1', [complaint])).rows.length,
    0,
  );
  ok('complaint private to author and admin');
});
await as(admin, async () => {
  await denied(
    () => db.query(`select resolve_complaint($1,'resolved','Done')`, [complaint]),
    /INVALID_TRANSITION/,
  );
  await db.query(`select resolve_complaint($1,'in_review','Checking')`, [complaint]);
  await denied(
    () => db.query(`select resolve_complaint($1,'resolved','')`, [complaint]),
    /RESPONSE_REQUIRED/,
  );
  await db.query(`select resolve_complaint($1,'resolved','Resolved the access issue')`, [
    complaint,
  ]);
  ok('complaint transition and response enforced');
});
await db.exec(
  'grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated',
);
assert.equal((await db.query('select * from storage.buckets where public=true')).rows.length, 0);
ok('all file buckets private');
await as(teacher, async () => {
  await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)', [
    'resources',
    course + '/notes.pdf',
    teacher,
  ]);
  ok('teacher uploads to own course storage');
});
await as(student, async () => {
  assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
  ok('enrolled student can access course resource object');
  await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)', [
    'complaint-attachments',
    student + '/private.pdf',
    student,
  ]);
});
await as(outsider, async () => {
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
  ok('non-member cannot access course resource or private complaint object');
});
await as(other, async () => {
  assert.equal(
    (await db.query("select * from storage.objects where bucket_id='complaint-attachments'")).rows
      .length,
    0,
  );
  ok('another enrolled student cannot read private complaint attachment');
});
await db.query('update profiles set is_active=false where id=$1', [student]);
await as(student, async () => {
  assert.equal((await db.query('select * from assignments')).rows.length, 0);
  ok('deactivated user loses course data access');
});
assert.equal(
  (
    await db.query(
      `select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity`,
    )
  ).rows.length,
  0,
);
ok('RLS enabled on every public table');
console.log(
  `${passed} database checks passed (local Postgres engine; hosted Auth, Storage and Realtime require separate integration checks).`,
);
await db.close();
