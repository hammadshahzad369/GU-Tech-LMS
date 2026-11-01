import type { RequestHandler } from 'express';
import * as service from '../services/community.js';
export const listAnnouncements: RequestHandler = (req, res, next) => {
  void service.listAnnouncements(req, res).catch(next);
};
export const createAnnouncement: RequestHandler = (req, res, next) => {
  void service.createAnnouncement(req, res).catch(next);
};
export const markAnnouncementsRead: RequestHandler = (req, res, next) => {
  void service.markAnnouncementsRead(req, res).catch(next);
};
export const updateAnnouncement: RequestHandler = (req, res, next) => {
  void service.updateAnnouncement(req, res).catch(next);
};
export const deleteAnnouncement: RequestHandler = (req, res, next) => {
  void service.deleteAnnouncement(req, res).catch(next);
};
export const listMessages: RequestHandler = (req, res, next) => {
  void service.listMessages(req, res).catch(next);
};
export const sendMessage: RequestHandler = (req, res, next) => {
  void service.sendMessage(req, res).catch(next);
};
export const deleteMessage: RequestHandler = (req, res, next) => {
  void service.deleteMessage(req, res).catch(next);
};
export const createComplaint: RequestHandler = (req, res, next) => {
  void service.createComplaint(req, res).catch(next);
};
export const listMyComplaints: RequestHandler = (req, res, next) => {
  void service.listMyComplaints(req, res).catch(next);
};
export const listAdminComplaints: RequestHandler = (req, res, next) => {
  void service.listAdminComplaints(req, res).catch(next);
};
export const resolveComplaint: RequestHandler = (req, res, next) => {
  void service.resolveComplaint(req, res).catch(next);
};
export const listAuditLog: RequestHandler = (req, res, next) => {
  void service.listAuditLog(req, res).catch(next);
};
