import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/community.js';
import { requireRole } from '../middleware/auth.js';
export const community = Router();
community.get('/announcements', controller.listAnnouncements);
community.post('/announcements', requireRole('teacher', 'admin'), controller.createAnnouncement);
community.post('/announcements/read', controller.markAnnouncementsRead);
community.patch(
  '/announcements/:id',
  requireRole('teacher', 'admin'),
  controller.updateAnnouncement,
);
community.delete(
  '/announcements/:id',
  requireRole('teacher', 'admin'),
  controller.deleteAnnouncement,
);
community.get('/courses/:id/messages', controller.listMessages);
community.post(
  '/courses/:id/messages',
  requireRole('teacher', 'student'),
  rateLimit({
    windowMs: 60000,
    limit: 20,
    keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  controller.sendMessage,
);
community.delete('/messages/:id', controller.deleteMessage);
community.post('/complaints', requireRole('student', 'teacher'), controller.createComplaint);
community.get('/complaints/mine', requireRole('student', 'teacher'), controller.listMyComplaints);
community.get('/admin/complaints', requireRole('admin'), controller.listAdminComplaints);
community.patch('/admin/complaints/:id', requireRole('admin'), controller.resolveComplaint);
community.get('/admin/audit', requireRole('admin'), controller.listAuditLog);
