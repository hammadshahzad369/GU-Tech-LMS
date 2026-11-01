import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
const state = vi.hoisted(() => ({
  role: 'student',
  active: true,
  mustChange: false,
  member: true,
  rpcError: null as null | string,
}));
vi.mock('../src/repositories/supabase.js', async () => {
  const actual = await vi.importActual<any>('../src/repositories/supabase.js');
  const query = (table: string) => {
    let single = false;
    const data = () =>
      table === 'profiles'
        ? {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'test@example.com',
            full_name: 'Test User',
            role: state.role,
            is_active: state.active,
            must_change_password: state.mustChange,
          }
        : table === 'assignments'
          ? {
              id: '00000000-0000-4000-8000-000000000002',
              course_id: '00000000-0000-4000-8000-000000000003',
              max_marks: 20,
            }
          : table === 'quizzes'
            ? {
                id: '00000000-0000-4000-8000-000000000002',
                course_id: '00000000-0000-4000-8000-000000000003',
                time_limit_minutes: 10,
                closes_at: new Date(Date.now() + 600000).toISOString(),
              }
            : table === 'resources'
              ? {
                  id: '00000000-0000-4000-8000-000000000002',
                  course_id: '00000000-0000-4000-8000-000000000003',
                  uploaded_by: 'other',
                  file_path: 'x',
                  file_name: 'x.pdf',
                }
              : table === 'announcements'
                ? { id: '00000000-0000-4000-8000-000000000002', author_id: 'other' }
                : { id: '00000000-0000-4000-8000-000000000002' };
    const q: any = {};
    for (const k of [
      'select',
      'eq',
      'in',
      'ilike',
      'order',
      'range',
      'lt',
      'lte',
      'limit',
      'insert',
      'upsert',
      'update',
      'delete',
    ])
      q[k] = () => q;
    q.single = () => {
      single = true;
      return q;
    };
    q.maybeSingle = () => {
      single = true;
      return q;
    };
    q.then = (resolve: any) => resolve({ data: single ? data() : [], error: null, count: 0 });
    return q;
  };
  const db = {
    from: query,
    rpc: async (name: string) => ({
      data: ['member', 'manage_course'].includes(name)
        ? state.member
        : { id: '00000000-0000-4000-8000-000000000002', started_at: new Date().toISOString() },
      error: state.rpcError ? { message: state.rpcError } : null,
    }),
    auth: {
      signInWithPassword: async () => ({
        data: {
          user: { id: '00000000-0000-4000-8000-000000000001' },
          session: { access_token: 'valid', refresh_token: 'refresh' },
        },
        error: null,
      }),
      refreshSession: async () => ({
        data: {
          user: { id: '00000000-0000-4000-8000-000000000001' },
          session: { access_token: 'valid', refresh_token: 'refresh' },
        },
        error: null,
      }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({
        data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
        error: null,
      }),
      admin: { signOut: async () => ({ error: null }) },
      getUser: async (token: string) => ({
        data: { user: token === 'valid' ? { id: '00000000-0000-4000-8000-000000000001' } : null },
        error: token === 'valid' ? null : { message: 'invalid' },
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: 'test.pdf' }, error: null }),
        remove: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: 'https://example.com/signed' },
          error: null,
        }),
      }),
    },
  };
  return {
    ...actual,
    client: () => db,
    adminClient: () => ({
      ...db,
      auth: {
        admin: {
          createUser: async () => ({
            data: { user: { id: '00000000-0000-4000-8000-000000000009' } },
            error: null,
          }),
          deleteUser: async () => ({ data: {}, error: null }),
        },
      },
    }),
  };
});
const id = '00000000-0000-4000-8000-000000000002';
beforeEach(() => {
  state.role = 'student';
  state.active = true;
  state.mustChange = false;
  state.member = true;
  state.rpcError = null;
});
describe('API boundary and validation', () => {
  it('serves a meaningful health response', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.data.service).toBe('gutech-api');
  });
  it('rejects malformed login', async () => {
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'bad', password: '' })).status,
    ).toBe(422);
  });
  it('does not expose signup endpoint', async () => {
    const r = await request(app).post('/api/auth/signup').send({});
    expect([401, 404]).toContain(r.status);
  });
  it('rejects inactive accounts with valid tokens', async () => {
    state.active = false;
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', 'Bearer valid')).status,
    ).toBe(403);
  });
  it('blocks course access before temporary password change', async () => {
    state.mustChange = true;
    expect(
      (await request(app).get('/api/me/courses').set('Authorization', 'Bearer valid')).status,
    ).toBe(403);
  });
  it('rejects cross-origin writes', async () => {
    expect(
      (await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.example').send({}))
        .status,
    ).toBe(403);
  });
  it('caps pagination', async () => {
    expect(
      (await request(app).get('/api/me/courses?pageSize=1000').set('Authorization', 'Bearer valid'))
        .status,
    ).toBe(422);
  });
  it('prevents another student marks request', async () => {
    expect(
      (await request(app).get('/api/me/marks?studentId=other').set('Authorization', 'Bearer valid'))
        .status,
    ).toBe(403);
  });
  it('rejects another course access', async () => {
    state.member = false;
    expect(
      (
        await request(app)
          .get(`/api/courses/${id}/assignments`)
          .set('Authorization', 'Bearer valid')
      ).status,
    ).toBe(403);
  });
  it('rejects global announcement from teacher', async () => {
    state.role = 'teacher';
    expect(
      (
        await request(app)
          .post('/api/announcements')
          .set('Authorization', 'Bearer valid')
          .send({ title: 'Test', body: 'Hello', courseId: null })
      ).status,
    ).toBe(403);
  });
  it('requires response when resolving complaint', async () => {
    state.role = 'admin';
    expect(
      (
        await request(app)
          .patch(`/api/admin/complaints/${id}`)
          .set('Authorization', 'Bearer valid')
          .send({ status: 'resolved', adminResponse: '' })
      ).status,
    ).toBe(422);
  });
  it('maps server deadline conflicts', async () => {
    state.rpcError = 'DEADLINE_PASSED';
    expect(
      (
        await request(app)
          .put(`/api/assignments/${id}/submission`)
          .set('Authorization', 'Bearer valid')
          .send({ textAnswer: 'My answer' })
      ).status,
    ).toBe(409);
  });
  it('does not permit student grade mutation', async () => {
    expect(
      (
        await request(app)
          .patch(`/api/submissions/${id}/grade`)
          .set('Authorization', 'Bearer valid')
          .send({ marks: 20, feedback: 'x' })
      ).status,
    ).toBe(403);
  });
  it('never serializes quiz answer keys in attempt response', async () => {
    const r = await request(app)
      .post(`/api/quizzes/${id}/attempt`)
      .set('Authorization', 'Bearer valid')
      .send({});
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/correctOption|correct_option/);
  });
});
const reads = [
  [`/quizzes/${id}/editor`, 'teacher'],
  ['/marks/summary', 'student'],
  ['/auth/me', 'student'],
  ['/me/courses', 'student'],
  ['/admin/users', 'admin'],
  ['/admin/courses', 'admin'],
  [`/courses/${id}`, 'student'],
  [`/admin/courses/${id}/members`, 'admin'],
  [`/courses/${id}/assignments`, 'student'],
  [`/assignments/${id}/submissions`, 'teacher'],
  [`/courses/${id}/quizzes`, 'student'],
  [`/quizzes/${id}/results`, 'teacher'],
  ['/me/marks', 'student'],
  [`/courses/${id}/gradebook`, 'teacher'],
  [`/courses/${id}/gradebook.csv`, 'teacher'],
  ['/announcements', 'student'],
  [`/courses/${id}/messages`, 'student'],
  ['/complaints/mine', 'student'],
  ['/admin/complaints', 'admin'],
  ['/admin/audit', 'admin'],
  [`/courses/${id}/resources`, 'student'],
  [`/resources/${id}/download`, 'student'],
];
describe.each(reads)('GET %s', (path, role) => {
  it('accepts the authorized role with repository fixture', async () => {
    state.role = role;
    expect(
      (
        await request(app)
          .get('/api' + path)
          .set('Authorization', 'Bearer valid')
      ).status,
    ).toBe(200);
  });
  it('rejects an unauthenticated request', async () => {
    expect((await request(app).get('/api' + path)).status).toBe(401);
  });
});

describe('session and write operations', () => {
  it('logs in and stores the refresh credential only in an httpOnly cookie', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'ValidPassword12' });
    expect(r.status).toBe(200);
    expect(r.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(r.body.data).not.toHaveProperty('refreshToken');
  });
  it('refreshes using the cookie', async () => {
    expect(
      (await request(app).post('/api/auth/refresh').set('Cookie', 'lms_refresh=refresh').send({}))
        .status,
    ).toBe(200);
  });
  it('rejects refresh without cookie', async () => {
    expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(401);
  });
  it('logs out authenticated session', async () => {
    expect(
      (await request(app).post('/api/auth/logout').set('Authorization', 'Bearer valid').send({}))
        .status,
    ).toBe(200);
  });
  it('does not reveal whether a reset email exists', async () => {
    const r = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.com' });
    expect(r.status).toBe(200);
    expect(r.body.data.message).toMatch(/If an account exists/);
  });
});
const writes: [string, string, string, unknown][] = [
  [
    'post',
    '/admin/users',
    'admin',
    {
      fullName: 'New Student',
      email: 'new@example.com',
      role: 'student',
      tempPassword: 'NewPassword123',
    },
  ],
  ['patch', `/admin/users/${id}`, 'admin', { fullName: 'Updated' }],
  ['post', `/admin/users/${id}/reset-password`, 'admin', {}],
  ['post', '/admin/courses', 'admin', { code: 'CS102', title: 'Computing' }],
  ['patch', `/admin/courses/${id}`, 'admin', { title: 'Updated' }],
  ['put', `/admin/courses/${id}/teachers`, 'admin', { teacherIds: [id] }],
  ['delete', `/admin/courses/${id}/enrollments/${id}`, 'admin', {}],
  [
    'post',
    `/courses/${id}/assignments`,
    'teacher',
    {
      title: 'Assignment',
      instructions: 'Explain computing',
      maxMarks: 20,
      dueAt: new Date(Date.now() + 3600000).toISOString(),
    },
  ],
  ['patch', `/assignments/${id}`, 'teacher', { title: 'Updated assignment' }],
  ['delete', `/assignments/${id}`, 'teacher', {}],
  ['put', `/assignments/${id}/submission`, 'student', { textAnswer: 'My answer' }],
  ['patch', `/submissions/${id}/grade`, 'teacher', { marks: 10, feedback: 'Good' }],
  ['patch', `/quizzes/${id}`, 'teacher', { isPublished: true }],
  ['post', `/quizzes/${id}/attempt`, 'student', {}],
  ['post', `/quizzes/${id}/attempt/submit`, 'student', { answers: { [id]: ['a'] } }],
  ['post', '/announcements', 'admin', { title: 'Campus notice', body: 'Welcome to campus' }],
  ['post', '/announcements/read', 'student', { upTo: new Date().toISOString() }],
  ['patch', `/announcements/${id}`, 'admin', { title: 'Updated notice' }],
  ['delete', `/announcements/${id}`, 'admin', {}],
  ['post', `/courses/${id}/messages`, 'student', { body: 'Hello classmates' }],
  ['delete', `/messages/${id}`, 'teacher', {}],
  [
    'post',
    '/complaints',
    'student',
    {
      category: 'technical',
      subject: 'Issue with file',
      description: 'I cannot download the course file.',
    },
  ],
  ['patch', `/admin/complaints/${id}`, 'admin', { status: 'in_review', adminResponse: 'Checking' }],
];
describe.each(writes)('%s %s', (method, path, role, body) => {
  it('executes the authorized request with repository fixtures', async () => {
    state.role = role;
    const r = await (request(app) as any)
      [method]('/api' + path)
      .set('Authorization', 'Bearer valid')
      .send(body);
    expect([200, 201]).toContain(r.status);
  });
  it('rejects an unauthenticated request', async () => {
    expect((await (request(app) as any)[method]('/api' + path).send(body)).status).toBe(401);
  });
});

describe('private uploads and bulk enrollment', () => {
  it('uploads a PDF resource for an assigned teacher', async () => {
    state.role = 'teacher';
    const r = await request(app)
      .post(`/api/courses/${id}/resources`)
      .set('Authorization', 'Bearer valid')
      .field('title', 'Lecture notes')
      .attach('file', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      });
    expect(r.status).toBe(201);
  });
  it('blocks student resource uploads', async () => {
    expect(
      (await request(app).post(`/api/courses/${id}/resources`).set('Authorization', 'Bearer valid'))
        .status,
    ).toBe(403);
  });
  it('rejects a disguised executable using file signature', async () => {
    state.role = 'teacher';
    const r = await request(app)
      .post(`/api/courses/${id}/resources`)
      .set('Authorization', 'Bearer valid')
      .field('title', 'Bad notes')
      .attach('file', Buffer.from('MZ' + 'x'.repeat(100)), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      });
    expect(r.status).toBe(422);
  });
  it('rejects resource uploads over 25 MB', async () => {
    state.role = 'teacher';
    const r = await request(app)
      .post(`/api/courses/${id}/resources`)
      .set('Authorization', 'Bearer valid')
      .field('title', 'Large notes')
      .attach('file', Buffer.alloc(26 * 1024 * 1024), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      });
    expect(r.status).toBe(413);
  });
  it('supports own private submission file upload', async () => {
    const r = await request(app)
      .post('/api/files/submissions')
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'), {
        filename: 'answer.pdf',
        contentType: 'application/pdf',
      });
    expect(r.status).toBe(201);
    expect(r.body.data.path).toMatch(/^00000000-0000-4000-8000-000000000001\//);
  });
  it('previews unmatched CSV email addresses', async () => {
    state.role = 'admin';
    const r = await request(app)
      .post(`/api/admin/courses/${id}/enrollments/csv`)
      .set('Authorization', 'Bearer valid')
      .field('preview', 'true')
      .attach('file', Buffer.from('email\nunknown@example.com\n'), 'students.csv');
    expect(r.status).toBe(200);
    expect(r.body.data.unmatched).toEqual(['unknown@example.com']);
    expect(r.body.data.imported).toBe(0);
  });
  it('rejects non-admin CSV imports', async () => {
    expect(
      (
        await request(app)
          .post(`/api/admin/courses/${id}/enrollments/csv`)
          .set('Authorization', 'Bearer valid')
      ).status,
    ).toBe(403);
  });
  it('prevents student access to quiz editor answer keys', async () => {
    expect(
      (await request(app).get(`/api/quizzes/${id}/editor`).set('Authorization', 'Bearer valid'))
        .status,
    ).toBe(403);
  });
});
