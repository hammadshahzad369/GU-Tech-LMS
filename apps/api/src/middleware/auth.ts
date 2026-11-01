import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'express';
import { client } from '../repositories/supabase.js';
import { ApiError } from '../utils/errors.js';
export type Role = 'admin' | 'teacher' | 'student';
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  roll_no?: string;
}
declare global {
  namespace Express {
    interface Request {
      db: SupabaseClient;
      user: Profile;
      token: string;
    }
  }
}
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Please log in.');
    const db = client(token);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user)
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
    const p = await db.from('profiles').select('*').eq('id', data.user.id).single();
    if (p.error || !p.data?.is_active)
      throw new ApiError(403, 'FORBIDDEN', 'Account unavailable or inactive.');
    req.db = db;
    req.user = p.data;
    req.token = token;
    next();
  } catch (e) {
    next(e);
  }
};
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      return next(new ApiError(403, 'FORBIDDEN', 'This action is not available for your role.'));
    next();
  };
export const passwordChanged: RequestHandler = (req, res, next) => {
  if (req.user.must_change_password)
    return next(
      new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password first.'),
    );
  next();
};
