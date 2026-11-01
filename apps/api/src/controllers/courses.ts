import type { RequestHandler } from 'express';
import * as service from '../services/courses.js';
export const listMyCourses: RequestHandler = (req, res, next) => {
  void service.listMyCourses(req, res).catch(next);
};
export const listAdminCourses: RequestHandler = (req, res, next) => {
  void service.listAdminCourses(req, res).catch(next);
};
export const createCourse: RequestHandler = (req, res, next) => {
  void service.createCourse(req, res).catch(next);
};
export const updateCourse: RequestHandler = (req, res, next) => {
  void service.updateCourse(req, res).catch(next);
};
export const getCourse: RequestHandler = (req, res, next) => {
  void service.getCourse(req, res).catch(next);
};
export const replaceTeachers: RequestHandler = (req, res, next) => {
  void service.replaceTeachers(req, res).catch(next);
};
export const listMembers: RequestHandler = (req, res, next) => {
  void service.listMembers(req, res).catch(next);
};
export const enrollStudents: RequestHandler = (req, res, next) => {
  void service.enrollStudents(req, res).catch(next);
};
export const unenrollStudent: RequestHandler = (req, res, next) => {
  void service.unenrollStudent(req, res).catch(next);
};
export const listAssignments: RequestHandler = (req, res, next) => {
  void service.listAssignments(req, res).catch(next);
};
export const createAssignment: RequestHandler = (req, res, next) => {
  void service.createAssignment(req, res).catch(next);
};
export const updateAssignment: RequestHandler = (req, res, next) => {
  void service.updateAssignment(req, res).catch(next);
};
export const deleteAssignment: RequestHandler = (req, res, next) => {
  void service.deleteAssignment(req, res).catch(next);
};
export const submitAssignment: RequestHandler = (req, res, next) => {
  void service.submitAssignment(req, res).catch(next);
};
export const listSubmissions: RequestHandler = (req, res, next) => {
  void service.listSubmissions(req, res).catch(next);
};
export const gradeSubmission: RequestHandler = (req, res, next) => {
  void service.gradeSubmission(req, res).catch(next);
};
export const listQuizzes: RequestHandler = (req, res, next) => {
  void service.listQuizzes(req, res).catch(next);
};
export const createQuiz: RequestHandler = (req, res, next) => {
  void service.createQuiz(req, res).catch(next);
};
export const updateQuiz: RequestHandler = (req, res, next) => {
  void service.updateQuiz(req, res).catch(next);
};
export const startQuiz: RequestHandler = (req, res, next) => {
  void service.startQuiz(req, res).catch(next);
};
export const submitQuiz: RequestHandler = (req, res, next) => {
  void service.submitQuiz(req, res).catch(next);
};
export const listQuizResults: RequestHandler = (req, res, next) => {
  void service.listQuizResults(req, res).catch(next);
};
export const listMyMarks: RequestHandler = (req, res, next) => {
  void service.listMyMarks(req, res).catch(next);
};
export const getGradebook: RequestHandler = (req, res, next) => {
  void service.getGradebook(req, res).catch(next);
};
export const importEnrollments: RequestHandler = (req, res, next) => {
  void service.importEnrollments(req, res).catch(next);
};
export const getMarksSummary: RequestHandler = (req, res, next) => {
  void service.getMarksSummary(req, res).catch(next);
};
export const getQuizEditor: RequestHandler = (req, res, next) => {
  void service.getQuizEditor(req, res).catch(next);
};
