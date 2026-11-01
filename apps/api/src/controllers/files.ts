import type { RequestHandler } from 'express';
import * as service from '../services/files.js';
export const listResources: RequestHandler = (req, res, next) => {
  void service.listResources(req, res).catch(next);
};
export const uploadResource: RequestHandler = (req, res, next) => {
  void service.uploadResource(req, res).catch(next);
};
export const downloadResource: RequestHandler = (req, res, next) => {
  void service.downloadResource(req, res).catch(next);
};
export const deleteResource: RequestHandler = (req, res, next) => {
  void service.deleteResource(req, res).catch(next);
};
export const uploadFile: RequestHandler = (req, res, next) => {
  void service.uploadFile(req, res).catch(next);
};
export const downloadSubmission: RequestHandler = (req, res, next) => {
  void service.downloadSubmission(req, res).catch(next);
};
export const downloadComplaintAttachment: RequestHandler = (req, res, next) => {
  void service.downloadComplaintAttachment(req, res).catch(next);
};
