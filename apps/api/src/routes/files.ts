import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/files.js';
import { requireRole } from '../middleware/auth.js';
export const files = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 5 },
}).single('file');
files.get('/courses/:id/resources', controller.listResources);
files.post(
  '/courses/:id/resources',
  requireRole('teacher', 'admin'),
  upload,
  controller.uploadResource,
);
files.get('/resources/:id/download', controller.downloadResource);
files.delete('/resources/:id', requireRole('teacher', 'admin'), controller.deleteResource);
files.post('/files/:bucket', requireRole('student', 'teacher'), upload, controller.uploadFile);
files.get('/submissions/:id/download', controller.downloadSubmission);
files.get('/complaints/:id/attachment', controller.downloadComplaintAttachment);
