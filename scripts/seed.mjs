import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    'Set server-side Supabase variables in .env or your secure environment settings.',
  );
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = (r) => {
  if (r.error) throw r.error;
  return r.data;
};
const password = process.env.DEMO_PASSWORD || `GuTech9!${randomBytes(12).toString('base64url')}`;
const users = [
  ['Campus Admin', 'admin', 'admin@gutech.demo'],
  ['Dr. Ayesha Khan', 'teacher', 'ayesha@gutech.demo'],
  ['Prof. Omar Ali', 'teacher', 'omar@gutech.demo'],
  ['Ahmed Raza', 'student', 'ahmed@gutech.demo'],
  ['Fatima Noor', 'student', 'fatima@gutech.demo'],
  ['Ali Hassan', 'student', 'ali@gutech.demo'],
  ['Sara Ahmed', 'student', 'sara@gutech.demo'],
  ['Usman Malik', 'student', 'usman@gutech.demo'],
];
const existing = [];
for (let page = 1; ; page++) {
  const d = check(await db.auth.admin.listUsers({ page, perPage: 100 }));
  existing.push(...d.users);
  if (d.users.length < 100) break;
}
const profiles = [];
let created = 0;
for (const [full_name, role, email] of users) {
  let u = existing.find((u) => u.email === email);
  if (!u) {
    u = check(await db.auth.admin.createUser({ email, password, email_confirm: true })).user;
    created++;
  }
  const profile = {
    id: u.id,
    full_name,
    email,
    role,
    roll_no: role === 'student' ? `GU-2026-${String(profiles.length - 2).padStart(3, '0')}` : null,
    is_active: true,
    must_change_password: false,
  };
  check(await db.from('profiles').upsert(profile));
  profiles.push(profile);
}
const courseList = [
  [
    'CS101',
    'Introduction to Computing',
    'Build strong foundations in computing, algorithms, and problem solving.',
  ],
  [
    'CS201',
    'Database Systems',
    'Explore relational models, SQL and the systems behind modern applications.',
  ],
  [
    'MA101',
    'Applied Mathematics',
    'Connect mathematical thinking to real-world engineering challenges.',
  ],
];
const courses = check(
  await db
    .from('courses')
    .upsert(
      courseList.map(([code, title, description]) => ({ code, title, description })),
      { onConflict: 'code' },
    )
    .select(),
);
for (const [i, c] of courses.entries()) {
  check(
    await db
      .from('course_teachers')
      .upsert({ course_id: c.id, teacher_id: profiles[1 + (i % 2)].id }),
  );
  check(
    await db
      .from('enrollments')
      .upsert(
        profiles
          .filter((p) => p.role === 'student')
          .map((p) => ({ course_id: c.id, student_id: p.id })),
      ),
  );
  const count = check(await db.from('assignments').select('id').eq('course_id', c.id).limit(1));
  if (!count.length) {
    check(
      await db.from('assignments').insert({
        course_id: c.id,
        created_by: profiles[1 + (i % 2)].id,
        title: `${c.code}: First steps`,
        instructions:
          'Explain one key concept from this week and provide a practical example. Submit a short answer or a PDF.',
        max_marks: 20,
        due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        allow_late: true,
      }),
    );
  }
}
for (const [i, c] of courses.entries()) {
  const teacher = profiles[1 + (i % 2)];
  const existingQuiz = check(
    await db
      .from('quizzes')
      .select('id')
      .eq('course_id', c.id)
      .eq('title', 'Knowledge check: ' + c.code)
      .limit(1),
  );
  if (!existingQuiz.length) {
    const quiz = check(
      await db
        .from('quizzes')
        .insert({
          course_id: c.id,
          created_by: teacher.id,
          title: 'Knowledge check: ' + c.code,
          description: 'A short practice quiz to get you started.',
          time_limit_minutes: 10,
          opens_at: new Date(Date.now() - 3600000).toISOString(),
          closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          is_published: true,
        })
        .select()
        .single(),
    );
    try {
      const questions = check(
        await db
          .from('quiz_questions')
          .insert([
            {
              quiz_id: quiz.id,
              position: 0,
              type: 'mcq_single',
              prompt: 'Which practice best protects a user account?',
              options: [
                { id: 'a', text: 'Sharing your password with classmates' },
                { id: 'b', text: 'Using a long, unique password' },
                { id: 'c', text: 'Reusing the same password everywhere' },
              ],
              marks: 5,
            },
            {
              quiz_id: quiz.id,
              position: 1,
              type: 'true_false',
              prompt: 'A database can store structured information in tables.',
              options: [
                { id: 'a', text: 'True' },
                { id: 'b', text: 'False' },
              ],
              marks: 5,
            },
          ])
          .select(),
      );
      check(
        await db.from('quiz_answers').insert(
          questions.map((q) => ({
            question_id: q.id,
            correct_option_ids: [q.position === 0 ? 'b' : 'a'],
          })),
        ),
      );
    } catch (e) {
      await db.from('quizzes').delete().eq('id', quiz.id);
      throw e;
    }
  }
  const a = check(
    await db.from('assignments').select('id,max_marks').eq('course_id', c.id).limit(1),
  )[0];
  if (a) {
    const prior = check(
      await db
        .from('submissions')
        .select('id')
        .eq('assignment_id', a.id)
        .eq('student_id', profiles[3].id)
        .limit(1),
    );
    if (!prior.length)
      check(
        await db.from('submissions').insert({
          assignment_id: a.id,
          student_id: profiles[3].id,
          text_answer:
            'Computational thinking breaks a complex problem into manageable steps. A practical example is planning a sequence of operations to process student results.',
          marks_obtained: 16,
          feedback: 'A clear explanation and a thoughtful practical example. Well done!',
          graded_by: teacher.id,
          graded_at: new Date().toISOString(),
        }),
      );
  }
}
const notice = check(
  await db
    .from('announcements')
    .select('id')
    .eq('title', 'Welcome to your connected campus')
    .limit(1),
);
if (!notice.length)
  check(
    await db.from('announcements').insert({
      author_id: profiles[0].id,
      title: 'Welcome to your connected campus',
      body: 'Your courses, resources, and classroom conversations are now together in one place. Explore your workspace and make this semester count.',
      is_pinned: true,
    }),
  );
if (created)
  await writeFile(
    '.demo-credentials.local.txt',
    `Demo accounts (private, do not commit)\nPassword for newly created accounts: ${password}\n${users.map((x) => `${x[1]}: ${x[2]}`).join('\n')}\nExisting account passwords were NOT changed.\n`,
    { mode: 0o600 },
  );
console.log(
  `Demo data ready: ${created} new accounts, 3 courses. Newly created account credentials are in .demo-credentials.local.txt (ignored by Git). Existing passwords unchanged.`,
);
