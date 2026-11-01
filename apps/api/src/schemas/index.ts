import { z } from 'zod';
export const uuid = z.string().uuid();
export const password = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/[0-9]/, 'Include a number');
export const login = z
  .object({ email: z.string().email().max(254), password: z.string().min(1).max(128) })
  .strict();
export const userCreate = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().email(),
    role: z.enum(['admin', 'teacher', 'student']),
    tempPassword: password,
    rollNo: z.string().max(50).optional(),
  })
  .strict();
export const userUpdate = userCreate
  .pick({ fullName: true, role: true, rollNo: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();
export const course = z
  .object({
    code: z.string().trim().min(2).max(30),
    title: z.string().trim().min(2).max(150),
    description: z.string().max(3000).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();
export const assignment = z
  .object({
    title: z.string().trim().min(2).max(200),
    instructions: z.string().min(1).max(10000),
    maxMarks: z.number().positive().max(9999),
    dueAt: z.string().datetime(),
    allowLate: z.boolean().default(false),
  })
  .strict();
const question = z
  .object({
    position: z.number().int().nonnegative(),
    type: z.enum(['mcq_single', 'mcq_multi', 'true_false']),
    prompt: z.string().min(1).max(4000),
    options: z
      .array(
        z.object({ id: z.string().min(1).max(20), text: z.string().min(1).max(1000) }).strict(),
      )
      .min(2)
      .max(10),
    marks: z.number().positive().max(999),
    correctOptionIds: z.array(z.string()).min(1).max(10),
  })
  .strict()
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    if (
      new Set(ids).size !== ids.length ||
      q.correctOptionIds.some((i) => !ids.includes(i)) ||
      new Set(q.correctOptionIds).size !== q.correctOptionIds.length ||
      (q.type !== 'mcq_multi' && q.correctOptionIds.length !== 1) ||
      (q.type === 'true_false' && q.options.length !== 2)
    )
      ctx.addIssue({ code: 'custom', message: 'Check options and correct answers.' });
  });
export const quiz = z
  .object({
    title: z.string().min(2).max(200),
    description: z.string().max(3000).optional(),
    timeLimitMinutes: z.number().int().min(1).max(240),
    opensAt: z.string().datetime(),
    closesAt: z.string().datetime(),
    isPublished: z.boolean().default(false),
    questions: z.array(question).min(1).max(100),
  })
  .strict()
  .refine((q) => new Date(q.closesAt) > new Date(q.opensAt), {
    message: 'Closing time must be after opening time.',
  });
export const announcement = z
  .object({
    courseId: uuid.nullable().optional(),
    title: z.string().min(2).max(200),
    body: z.string().min(1).max(10000),
    isPinned: z.boolean().default(false),
  })
  .strict();
export const complaint = z
  .object({
    courseId: uuid.nullable().optional(),
    category: z.enum(['academic', 'technical', 'facility', 'conduct', 'other']),
    subject: z.string().min(3).max(200),
    description: z.string().min(10).max(10000),
  })
  .strict();
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
