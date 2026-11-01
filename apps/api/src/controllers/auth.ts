import type { RequestHandler } from 'express';
import * as service from '../services/auth.js';
export const login: RequestHandler = (req, res, next) => {
  void service.login(req, res).catch(next);
};
export const refreshSession: RequestHandler = (req, res, next) => {
  void service.refreshSession(req, res).catch(next);
};
export const logout: RequestHandler = (req, res, next) => {
  void service.logout(req, res).catch(next);
};
export const forgotPassword: RequestHandler = (req, res, next) => {
  void service.forgotPassword(req, res).catch(next);
};
export const changePassword: RequestHandler = (req, res, next) => {
  void service.changePassword(req, res).catch(next);
};
export const resetPassword: RequestHandler = (req, res, next) => {
  void service.resetPassword(req, res).catch(next);
};
export const listUsers: RequestHandler = (req, res, next) => {
  void service.listUsers(req, res).catch(next);
};
export const createUser: RequestHandler = (req, res, next) => {
  void service.createUser(req, res).catch(next);
};
export const updateUser: RequestHandler = (req, res, next) => {
  void service.updateUser(req, res).catch(next);
};
export const resetUserPassword: RequestHandler = (req, res, next) => {
  void service.resetUserPassword(req, res).catch(next);
};
