import { parse as parseCsv } from 'csv-parse/sync';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { camel, snake } from '../repositories/supabase.js';
import { assignment, course, pagination, quiz, uuid } from '../schemas/index.js';
import { courseAccess, record } from '../services/access.js';
import { ApiError, checked } from '../utils/errors.js';

export async function listMyCourses(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('courses')
    .select('*', { count: 'exact' })
    .eq('is_archived', false)
    .order('code')
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function listAdminCourses(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('courses')
    .select('*', { count: 'exact' })
    .order('code')
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function createCourse(req: Request, res: Response) {
  res.status(201).json({
    data: camel(
      checked(
        await req.db
          .from('courses')
          .insert(snake(course.parse(req.body)))
          .select()
          .single(),
      ),
    ),
  });
}

export async function updateCourse(req: Request, res: Response) {
  res.json({
    data: camel(
      checked(
        await req.db
          .from('courses')
          .update(snake(course.partial().parse(req.body)))
          .eq('id', uuid.parse(req.params.id))
          .select()
          .single(),
      ),
    ),
  });
}

export async function getCourse(req: Request, res: Response) {
  await courseAccess(req, req.params.id);
  res.json({ data: camel(await record(req, 'courses', req.params.id)) });
}

export async function replaceTeachers(req: Request, res: Response) {
  const b = z
    .object({ teacherIds: z.array(uuid).max(50) })
    .strict()
    .parse(req.body);
  checked(
    await req.db.rpc('replace_teachers', {
      cid: uuid.parse(req.params.id),
      teachers: b.teacherIds,
    }),
  );
  res.json({ data: { ok: true } });
}

export async function listMembers(req: Request, res: Response) {
  const id = uuid.parse(req.params.id);
  const p = pagination.parse(req.query);
  const [t, s] = await Promise.all([
    req.db
      .from('course_teachers')
      .select('*,profiles(*)', { count: 'exact' })
      .eq('course_id', id)
      .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1),
    req.db
      .from('enrollments')
      .select('*,profiles(*)', { count: 'exact' })
      .eq('course_id', id)
      .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1),
  ]);
  checked(t);
  checked(s);
  res.json({
    data: camel({ teachers: t.data, students: s.data }),
    meta: { ...p, total: s.count, teachersTotal: t.count },
  });
}

export async function enrollStudents(req: Request, res: Response) {
  const b = z
    .object({ studentIds: z.array(uuid).min(1).max(100) })
    .strict()
    .parse(req.body);
  const cid = uuid.parse(req.params.id);
  const valid = checked(
    await req.db
      .from('profiles')
      .select('id')
      .in('id', b.studentIds)
      .eq('role', 'student')
      .eq('is_active', true),
  );
  if (valid.length !== new Set(b.studentIds).size)
    throw new ApiError(422, 'INVALID_STUDENT', 'Choose active student accounts.');
  const d = checked(
    await req.db
      .from('enrollments')
      .upsert(b.studentIds.map((student_id) => ({ course_id: cid, student_id })))
      .select(),
  );
  res.status(201).json({ data: camel(d) });
}

export async function unenrollStudent(req: Request, res: Response) {
  checked(
    await req.db
      .from('enrollments')
      .delete()
      .eq('course_id', uuid.parse(req.params.id))
      .eq('student_id', uuid.parse(req.params.studentId)),
  );
  res.json({ data: { ok: true } });
}

export async function listAssignments(req: Request, res: Response) {
  await courseAccess(req, req.params.id);
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('assignments')
    .select('*,submissions(*)', { count: 'exact' })
    .eq('course_id', req.params.id)
    .order('due_at')
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function createAssignment(req: Request, res: Response) {
  await courseAccess(req, req.params.id, true);
  const b = assignment.parse(req.body);
  res.status(201).json({
    data: camel(
      checked(
        await req.db
          .from('assignments')
          .insert({ ...snake(b), course_id: req.params.id, created_by: req.user.id })
          .select()
          .single(),
      ),
    ),
  });
}

export async function updateAssignment(req: Request, res: Response) {
  const a = await record(req, 'assignments', req.params.id);
  await courseAccess(req, a.course_id, true);
  res.json({
    data: camel(
      checked(
        await req.db
          .from('assignments')
          .update(snake(assignment.partial().parse(req.body)))
          .eq('id', a.id)
          .select()
          .single(),
      ),
    ),
  });
}

export async function deleteAssignment(req: Request, res: Response) {
  const a = await record(req, 'assignments', req.params.id);
  await courseAccess(req, a.course_id, true);
  checked(await req.db.from('assignments').delete().eq('id', a.id));
  res.json({ data: { ok: true } });
}

export async function submitAssignment(req: Request, res: Response) {
  const b = z
    .object({
      textAnswer: z.string().max(30000).default(''),
      filePath: z.string().max(500).nullable().optional(),
    })
    .strict()
    .parse(req.body);
  res.json({
    data: camel(
      checked(
        await req.db.rpc('submit_assignment', {
          aid: uuid.parse(req.params.id),
          answer: b.textAnswer,
          filepath: b.filePath || null,
        }),
      ),
    ),
  });
}

export async function listSubmissions(req: Request, res: Response) {
  const a = await record(req, 'assignments', req.params.id);
  await courseAccess(req, a.course_id, true);
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('submissions')
    .select('*,student:profiles!submissions_student_id_fkey(full_name,email,roll_no)', {
      count: 'exact',
    })
    .eq('assignment_id', a.id)
    .order('submitted_at')
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function gradeSubmission(req: Request, res: Response) {
  const b = z
    .object({ marks: z.number().min(0).max(9999), feedback: z.string().max(5000).default('') })
    .strict()
    .parse(req.body);
  res.json({
    data: camel(
      checked(
        await req.db.rpc('grade_submission', {
          sid: uuid.parse(req.params.id),
          marks: b.marks,
          note: b.feedback,
        }),
      ),
    ),
  });
}

export async function listQuizzes(req: Request, res: Response) {
  await courseAccess(req, req.params.id);
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('quizzes')
    .select('*,quiz_attempts(*)', { count: 'exact' })
    .eq('course_id', req.params.id)
    .order('created_at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function createQuiz(req: Request, res: Response) {
  await courseAccess(req, req.params.id, true);
  const b = quiz.parse(req.body);
  const id = checked(
    await req.db.rpc('save_quiz', { payload: { ...snake(b), course_id: req.params.id } }),
  );
  res.status(201).json({ data: { id } });
}

export async function updateQuiz(req: Request, res: Response) {
  const q = await record(req, 'quizzes', req.params.id);
  await courseAccess(req, q.course_id, true);
  const b = z.union([z.object({ isPublished: z.boolean() }).strict(), quiz]).parse(req.body);
  const id = checked(await req.db.rpc('save_quiz', { payload: snake(b), qid: q.id }));
  res.json({ data: { id } });
}

export async function startQuiz(req: Request, res: Response) {
  z.object({}).strict().parse(req.body);
  const qid = uuid.parse(req.params.id);
  const a = checked(await req.db.rpc('start_quiz', { qid }));
  const q = await record(req, 'quizzes', qid);
  const questions = checked(
    await req.db
      .from('quiz_questions')
      .select('id,position,type,prompt,options,marks')
      .eq('quiz_id', qid)
      .order('position'),
  );
  res.json({
    data: camel({
      ...a,
      questions,
      expires_at: new Date(
        Math.min(
          new Date(a.started_at).getTime() + q.time_limit_minutes * 60000,
          new Date(q.closes_at).getTime(),
        ),
      ).toISOString(),
    }),
  });
}

export async function submitQuiz(req: Request, res: Response) {
  const b = z
    .object({ answers: z.record(uuid, z.array(z.string().max(20)).max(10)) })
    .strict()
    .parse(req.body);
  res.json({
    data: camel(
      checked(
        await req.db.rpc('finish_quiz', { qid: uuid.parse(req.params.id), given: b.answers }),
      ),
    ),
  });
}

export async function listQuizResults(req: Request, res: Response) {
  const q = await record(req, 'quizzes', req.params.id);
  await courseAccess(req, q.course_id, true);
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('quiz_attempts')
    .select('*,student:profiles(full_name,email)', { count: 'exact' })
    .eq('quiz_id', q.id)
    .order('started_at')
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function listMyMarks(req: Request, res: Response) {
  if (req.query.studentId && req.query.studentId !== req.user.id)
    throw new ApiError(403, 'FORBIDDEN');
  const p = pagination.parse(req.query);
  let q = req.db
    .from('v_student_marks')
    .select('*', { count: 'exact' })
    .eq('student_id', req.user.id)
    .order('title')
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  if (req.query.courseId) q = q.eq('course_id', uuid.parse(req.query.courseId));
  const r = await q;
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function getGradebook(req: Request, res: Response) {
  await courseAccess(req, req.params.id, true);
  const p = pagination.parse(req.query);
  const itemPage = z.coerce.number().int().min(1).default(1).parse(req.query.itemPage);
  const [enrolled, assignments, quizzes] = await Promise.all([
    req.db
      .from('enrollments')
      .select('student_id,student:profiles!enrollments_student_id_fkey(id,full_name,roll_no)', {
        count: 'exact',
      })
      .eq('course_id', req.params.id)
      .order('student_id')
      .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1),
    req.db
      .from('assignments')
      .select('id,title,max_marks', { count: 'exact' })
      .eq('course_id', req.params.id)
      .order('created_at')
      .range((itemPage - 1) * 50, itemPage * 50 - 1),
    req.db
      .from('quizzes')
      .select('id,title,quiz_questions(marks)', { count: 'exact' })
      .eq('course_id', req.params.id)
      .order('created_at')
      .range((itemPage - 1) * 50, itemPage * 50 - 1),
  ]);
  checked(enrolled);
  checked(assignments);
  checked(quizzes);
  const items = [
    ...(assignments.data || []).map((a: any) => ({
      itemId: a.id,
      title: a.title,
      kind: 'assignment',
      max: Number(a.max_marks),
    })),
    ...(quizzes.data || []).map((q: any) => ({
      itemId: q.id,
      title: q.title,
      kind: 'quiz',
      max: q.quiz_questions.reduce((sum: number, x: any) => sum + Number(x.marks), 0),
    })),
  ];
  const ids = (enrolled.data || []).map((e: any) => e.student_id);
  const marks = ids.length
    ? checked(
        await req.db
          .from('v_student_marks')
          .select('*')
          .eq('course_id', req.params.id)
          .in('student_id', ids)
          .in(
            'item_id',
            items.map((i) => i.itemId),
          )
          .limit(10000),
      )
    : [];
  const summaries = checked(await req.db.rpc('marks_summary', { cid: req.params.id }));
  const rows = (enrolled.data || []).map((e: any) => {
    const summary = Array.isArray(summaries)
      ? summaries.find((m: any) => m.student_id === e.student_id)
      : null;
    return {
      studentId: e.student_id,
      studentName: e.student?.full_name || e.student_id,
      rollNo: e.student?.roll_no,
      items: items.map((i) => ({
        ...i,
        obtained:
          marks.find((m: any) => m.student_id === e.student_id && m.item_id === i.itemId)
            ?.obtained ?? null,
      })),
      obtained: Number(summary?.obtained || 0),
      maximum: Number(summary?.maximum || 0),
    };
  });
  if (req.path.endsWith('.csv')) {
    const quote = (v: unknown) =>
      '"' +
      String(v ?? '')
        .replace(/^[=+@-]/, "'")
        .replace(/"/g, '""') +
      '"';
    res.setHeader('Content-Disposition', 'attachment; filename="gradebook.csv"');
    res
      .type('text/csv')
      .send(
        '\uFEFF' +
          [
            'Student',
            'Roll number',
            ...items.map((i) => i.title),
            'Graded total',
            'Graded maximum',
            'Percentage',
          ]
            .map(quote)
            .join(',') +
          '\r\n' +
          rows
            .map((r) =>
              [
                r.studentName,
                r.rollNo,
                ...r.items.map((i) => i.obtained ?? 'Pending'),
                r.obtained,
                r.maximum,
                r.maximum ? ((r.obtained / r.maximum) * 100).toFixed(1) : '0',
              ]
                .map(quote)
                .join(','),
            )
            .join('\r\n'),
      );
  } else
    res.json({
      data: rows,
      meta: {
        ...p,
        total: enrolled.count,
        itemPage,
        itemPageSize: 50,
        assignmentCount: assignments.count,
        quizCount: quizzes.count,
      },
    });
}

export async function importEnrollments(req: Request, res: Response) {
  const cid = uuid.parse(req.params.id);
  const b = z
    .object({ preview: z.enum(['true', 'false']).default('true') })
    .strict()
    .parse(req.body);
  if (!req.file)
    throw new ApiError(422, 'FILE_REQUIRED', 'Choose a CSV file with an email column.');
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      max_record_size: 1000,
    });
  } catch {
    throw new ApiError(422, 'INVALID_CSV', 'Use a valid CSV with an email header.');
  }
  if (!rows.length || rows.length > 100)
    throw new ApiError(422, 'INVALID_CSV', 'Import between 1 and 100 rows at a time.');
  const emails = [...new Set(rows.map((r) => z.string().email().parse(r.email).toLowerCase()))];
  const students = checked(
    await req.db
      .from('profiles')
      .select('id,email,full_name')
      .in('email', emails)
      .eq('role', 'student')
      .eq('is_active', true),
  );
  const unmatched = emails.filter((e) => !students.some((s) => s.email.toLowerCase() === e));
  if (b.preview === 'false' && students.length)
    checked(
      await req.db
        .from('enrollments')
        .upsert(students.map((s) => ({ course_id: cid, student_id: s.id }))),
    );
  res.json({
    data: camel({
      matched: students,
      unmatched,
      imported: b.preview === 'false' ? students.length : 0,
    }),
  });
}

export async function getMarksSummary(req: Request, res: Response) {
  const cid = req.query.courseId ? uuid.parse(req.query.courseId) : null;
  if (req.user.role !== 'student' && !cid) throw new ApiError(422, 'COURSE_REQUIRED');
  res.json({ data: camel(checked(await req.db.rpc('marks_summary', { cid }))) });
}
export async function getQuizEditor(req: Request, res: Response) {
  const q = await record(req, 'quizzes', req.params.id);
  await courseAccess(req, q.course_id, true);
  const questions = checked(
    await req.db
      .from('quiz_questions')
      .select('*,quiz_answers(correct_option_ids)')
      .eq('quiz_id', q.id)
      .order('position')
      .limit(100),
  );
  res.json({ data: camel({ ...q, questions }) });
}
