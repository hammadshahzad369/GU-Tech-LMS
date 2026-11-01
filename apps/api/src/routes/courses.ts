import { Router } from 'express';
import multer from 'multer';
import * as controller from '../controllers/courses.js';
import { requireRole } from '../middleware/auth.js';
export const courses = Router();
courses.get('/me/courses', controller.listMyCourses);
courses.get('/admin/courses', requireRole('admin'), controller.listAdminCourses);
courses.post('/admin/courses', requireRole('admin'), controller.createCourse);
courses.patch('/admin/courses/:id', requireRole('admin'), controller.updateCourse);
courses.get('/courses/:id', controller.getCourse);
courses.put('/admin/courses/:id/teachers', requireRole('admin'), controller.replaceTeachers);
courses.get('/admin/courses/:id/members', requireRole('admin'), controller.listMembers);
courses.post('/admin/courses/:id/enrollments', requireRole('admin'), controller.enrollStudents);
courses.delete(
  '/admin/courses/:id/enrollments/:studentId',
  requireRole('admin'),
  controller.unenrollStudent,
);
courses.get('/courses/:id/assignments', controller.listAssignments);
courses.post(
  '/courses/:id/assignments',
  requireRole('teacher', 'admin'),
  controller.createAssignment,
);
courses.patch('/assignments/:id', requireRole('teacher', 'admin'), controller.updateAssignment);
courses.delete('/assignments/:id', requireRole('teacher', 'admin'), controller.deleteAssignment);
courses.put('/assignments/:id/submission', requireRole('student'), controller.submitAssignment);
courses.get(
  '/assignments/:id/submissions',
  requireRole('teacher', 'admin'),
  controller.listSubmissions,
);
courses.patch(
  '/submissions/:id/grade',
  requireRole('teacher', 'admin'),
  controller.gradeSubmission,
);
courses.get('/courses/:id/quizzes', controller.listQuizzes);
courses.post('/courses/:id/quizzes', requireRole('teacher', 'admin'), controller.createQuiz);
courses.patch('/quizzes/:id', requireRole('teacher', 'admin'), controller.updateQuiz);
courses.post('/quizzes/:id/attempt', requireRole('student'), controller.startQuiz);
courses.post('/quizzes/:id/attempt/submit', requireRole('student'), controller.submitQuiz);
courses.get('/quizzes/:id/results', requireRole('teacher', 'admin'), controller.listQuizResults);
courses.get('/me/marks', requireRole('student'), controller.listMyMarks);
for (const csv of [false, true])
  courses.get(
    '/courses/:id/gradebook' + (csv ? '.csv' : ''),
    requireRole('teacher', 'admin'),
    controller.getGradebook,
  );

courses.post(
  '/admin/courses/:id/enrollments/csv',
  requireRole('admin'),
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } }).single(
    'file',
  ),
  controller.importEnrollments,
);
courses.get('/marks/summary', controller.getMarksSummary);
courses.get('/quizzes/:id/editor', requireRole('teacher', 'admin'), controller.getQuizEditor);
