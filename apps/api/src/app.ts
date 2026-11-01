import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import 'express-async-errors';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { passwordChanged, requireAuth } from './middleware/auth.js';
import { auth } from './routes/auth.js';
import { community } from './routes/community.js';
import { courses } from './routes/courses.js';
import { files } from './routes/files.js';
import { ApiError } from './utils/errors.js';
export const app = express();
const logger = pino();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        connectSrc: ["'self'", ...(env.url ? [env.url, env.url.replace(/^https:/, 'wss:')] : [])],
      },
    },
  }),
);
app.use(cors({ origin: env.origin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== env.origin
  )
    return next(new ApiError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.'));
  next();
});
app.use(
  '/api',
  rateLimit({ windowMs: 60000, limit: 200, standardHeaders: 'draft-7', legacyHeaders: false }),
);
app.get('/api/health', (req, res) => res.json({ data: { status: 'ok', service: 'gutech-api' } }));
app.all(['/api/auth/signup', '/signup'], (req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }),
);
app.use('/api', auth);
app.use('/api', requireAuth, passwordChanged, courses, community, files);
if (process.env.SERVE_WEB === 'true') {
  const web = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.use(express.static(web));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => res.sendFile(web + 'index.html'));
}
app.use((req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }),
);
app.use(
  (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof ZodError)
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((i) => i.message).join(', '),
          details: error.issues,
        },
      });
    if (error instanceof ApiError)
      return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error instanceof multer.MulterError)
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({
        error: {
          code: error.code,
          message: 'Upload rejected. Maximum file size is 25 MB (complaints: 10 MB).',
        },
      });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON.' } });
    logger.error({
      event: 'request_failed',
      method: req.method,
      path: req.path,
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  },
);
