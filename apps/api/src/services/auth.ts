import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { adminClient, camel, client, snake } from '../repositories/supabase.js';
import {
  login as loginSchema,
  pagination,
  password,
  userCreate,
  userUpdate,
  uuid,
} from '../schemas/index.js';
import { ApiError, checked } from '../utils/errors.js';
const cookieOptions = {
  httpOnly: true,
  secure: env.production,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 3600000,
};
const sendSession = (res: any, session: any, profile: any) => {
  res.cookie('lms_refresh', session.refresh_token, cookieOptions);
  res.json({ data: { accessToken: session.access_token, profile: camel(profile) } });
};
export async function login(req: Request, res: Response) {
  const b = loginSchema.parse(req.body);
  const db = client();
  const { data, error } = await db.auth.signInWithPassword(b);
  if (error || !data.session)
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const p = await db.from('profiles').select('*').eq('id', data.user.id).single();
  if (p.error || !p.data?.is_active) {
    await db.auth.signOut();
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  sendSession(res, data.session, p.data);
}

export async function refreshSession(req: Request, res: Response) {
  z.object({})
    .strict()
    .parse(req.body || {});
  const token = req.cookies?.lms_refresh;
  if (!token) throw new ApiError(401, 'UNAUTHORIZED');
  const db = client();
  const { data, error } = await db.auth.refreshSession({ refresh_token: token });
  if (error || !data.session) throw new ApiError(401, 'UNAUTHORIZED');
  const p = await db.from('profiles').select('*').eq('id', data.user!.id).single();
  if (p.error || !p.data?.is_active) throw new ApiError(401, 'UNAUTHORIZED');
  sendSession(res, data.session, p.data);
}

export async function logout(req: Request, res: Response) {
  checked(await req.db.auth.admin.signOut(req.token, 'global'));
  res.clearCookie('lms_refresh', {
    httpOnly: true,
    secure: env.production,
    sameSite: 'lax',
    path: '/api/auth',
  });
  res.json({ data: { ok: true } });
}

export async function forgotPassword(req: Request, res: Response) {
  const b = z.object({ email: z.string().email() }).strict().parse(req.body);
  await client().auth.resetPasswordForEmail(b.email, { redirectTo: env.reset });
  res.json({ data: { message: 'If an account exists, a reset link has been sent.' } });
}

export async function changePassword(req: Request, res: Response) {
  const b = z
    .object({ currentPassword: z.string().min(1), newPassword: password })
    .strict()
    .parse(req.body);
  if (b.currentPassword === b.newPassword)
    throw new ApiError(422, 'VALIDATION_ERROR', 'Choose a different password.');
  const check = await client().auth.signInWithPassword({
    email: req.user.email,
    password: b.currentPassword,
  });
  if (check.error) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  checked(await req.db.auth.updateUser({ password: b.newPassword }));
  checked(
    await adminClient()
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', req.user.id),
  );
  checked(await req.db.auth.admin.signOut(req.token, 'others'));
  res.json({ data: { ok: true } });
}

export async function resetPassword(req: Request, res: Response) {
  const b = z.object({ newPassword: password }).strict().parse(req.body);
  const payload = JSON.parse(Buffer.from(req.token.split('.')[1], 'base64url').toString());
  if (
    !Array.isArray(payload.amr) ||
    !payload.amr.some((x: any) => ['recovery', 'otp'].includes(x.method))
  )
    throw new ApiError(403, 'RECOVERY_REQUIRED', 'Use the recovery link sent to your email.');
  checked(await req.db.auth.updateUser({ password: b.newPassword }));
  checked(
    await adminClient()
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', req.user.id),
  );
  checked(await req.db.auth.admin.signOut(req.token, 'others'));
  res.json({ data: { ok: true } });
}

export async function listUsers(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  let q = req.db
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  if (req.query.role)
    q = q.eq('role', z.enum(['admin', 'teacher', 'student']).parse(req.query.role));
  if (req.query.search)
    q = q.ilike('full_name', `%${z.string().max(100).parse(req.query.search)}%`);
  const r = await q;
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function createUser(req: Request, res: Response) {
  const b = userCreate.parse(req.body);
  const adm = adminClient();
  const u = checked(
    await adm.auth.admin.createUser({
      email: b.email,
      password: b.tempPassword,
      email_confirm: true,
    }),
  );
  if (!u.user) throw new ApiError(422, 'USER_CREATE_FAILED');
  const p = await adm
    .from('profiles')
    .insert({
      id: u.user.id,
      full_name: b.fullName,
      email: b.email,
      role: b.role,
      roll_no: b.rollNo,
      must_change_password: true,
    })
    .select()
    .single();
  if (p.error) {
    await adm.auth.admin.deleteUser(u.user.id);
    checked(p);
  }
  checked(
    await req.db.rpc('log_admin_action', { action_name: 'create_user', target_id: u.user.id }),
  );
  res.status(201).json({ data: camel(p.data) });
}

export async function updateUser(req: Request, res: Response) {
  const id = uuid.parse(req.params.id);
  const b = userUpdate.parse(req.body);
  if (id === req.user.id && (b.isActive === false || (b.role && b.role !== 'admin')))
    throw new ApiError(409, 'CONFLICT', 'You cannot deactivate or demote yourself.');
  const p = checked(
    await adminClient().from('profiles').update(snake(b)).eq('id', id).select().single(),
  );
  checked(await req.db.rpc('log_admin_action', { action_name: 'update_user', target_id: id }));
  res.json({ data: camel(p) });
}

export async function resetUserPassword(req: Request, res: Response) {
  z.object({}).strict().parse(req.body);
  const p = checked(
    await req.db.from('profiles').select('email').eq('id', uuid.parse(req.params.id)).single(),
  );
  checked(await client().auth.resetPasswordForEmail(p.email, { redirectTo: env.reset }));
  res.json({ data: { ok: true } });
}
