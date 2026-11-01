import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/auth.js';
import { passwordChanged, requireAuth, requireRole } from '../middleware/auth.js';
import { camel } from '../repositories/supabase.js';
export const auth = Router();

auth.post(
  '/auth/login',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 5,
    keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  controller.login,
);
auth.post('/auth/refresh', controller.refreshSession);
auth.post('/auth/logout', requireAuth, controller.logout);
auth.get('/auth/me', requireAuth, (req, res) => res.json({ data: camel(req.user) }));
auth.post(
  '/auth/forgot-password',
  rateLimit({
    windowMs: 3600000,
    limit: 3,
    keyGenerator: (req) => String(req.body?.email || '').toLowerCase(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  controller.forgotPassword,
);
auth.post('/auth/change-password', requireAuth, controller.changePassword);
auth.post('/auth/reset-password', requireAuth, controller.resetPassword);
auth.get('/admin/users', requireAuth, passwordChanged, requireRole('admin'), controller.listUsers);
auth.post(
  '/admin/users',
  requireAuth,
  passwordChanged,
  requireRole('admin'),
  controller.createUser,
);
auth.patch(
  '/admin/users/:id',
  requireAuth,
  passwordChanged,
  requireRole('admin'),
  controller.updateUser,
);
auth.post(
  '/admin/users/:id/reset-password',
  requireAuth,
  passwordChanged,
  requireRole('admin'),
  controller.resetUserPassword,
);
