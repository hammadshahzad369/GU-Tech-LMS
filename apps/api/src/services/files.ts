import type { Request, Response } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { camel } from '../repositories/supabase.js';
import { pagination } from '../schemas/index.js';
import { courseAccess, record } from '../services/access.js';
import { ApiError, checked } from '../utils/errors.js';
const allowed = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
async function validated(file: Express.Multer.File | undefined, max = 25 * 1024 * 1024) {
  if (!file) throw new ApiError(422, 'FILE_REQUIRED', 'Choose a file.');
  if (file.size > max) throw new ApiError(413, 'FILE_TOO_LARGE', 'File exceeds the size limit.');
  const type = await fileTypeFromBuffer(file.buffer);
  if (!type || !allowed.has(type.mime))
    throw new ApiError(422, 'UNSUPPORTED_FILE', 'Use PDF, DOCX, PPTX, ZIP, PNG, JPEG or WebP.');
  return { file, type };
}
export async function listResources(req: Request, res: Response) {
  await courseAccess(req, req.params.id);
  const p = pagination.parse(req.query);
  let q = req.db
    .from('resources')
    .select('*', { count: 'exact' })
    .eq('course_id', req.params.id)
    .order('created_at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  if (req.query.search) q = q.ilike('title', `%${z.string().max(100).parse(req.query.search)}%`);
  const r = await q;
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function uploadResource(req: Request, res: Response) {
  await courseAccess(req, req.params.id, true);
  const b = z
    .object({
      title: z.string().trim().min(2).max(200),
      description: z.string().max(3000).optional(),
    })
    .strict()
    .parse(req.body);
  const { file, type } = await validated(req.file);
  const path = `${req.params.id}/${randomUUID()}.${type.ext}`;
  checked(
    await req.db.storage.from('resources').upload(path, file.buffer, { contentType: type.mime }),
  );
  const r = await req.db
    .from('resources')
    .insert({
      course_id: req.params.id,
      uploaded_by: req.user.id,
      title: b.title,
      description: b.description,
      file_path: path,
      file_name: file.originalname,
      mime_type: type.mime,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (r.error) {
    await req.db.storage.from('resources').remove([path]);
    checked(r);
  }
  res.status(201).json({ data: camel(r.data) });
}

export async function downloadResource(req: Request, res: Response) {
  const r = await record(req, 'resources', req.params.id);
  await courseAccess(req, r.course_id);
  const d = checked(
    await req.db.storage
      .from('resources')
      .createSignedUrl(r.file_path, 60, { download: r.file_name }),
  );
  res.json({ data: d });
}

export async function deleteResource(req: Request, res: Response) {
  const r = await record(req, 'resources', req.params.id);
  if (req.user.role !== 'admin' && r.uploaded_by !== req.user.id)
    throw new ApiError(403, 'FORBIDDEN');
  checked(await req.db.storage.from('resources').remove([r.file_path]));
  checked(await req.db.from('resources').delete().eq('id', r.id));
  res.json({ data: { ok: true } });
}

export async function uploadFile(req: Request, res: Response) {
  const bucket = z.enum(['submissions', 'complaint-attachments']).parse(req.params.bucket);
  z.object({}).strict().parse(req.body);
  const { file, type } = await validated(
    req.file,
    bucket === 'complaint-attachments' ? 10 * 1024 * 1024 : 25 * 1024 * 1024,
  );
  const path = `${req.user.id}/${randomUUID()}.${type.ext}`;
  checked(await req.db.storage.from(bucket).upload(path, file.buffer, { contentType: type.mime }));
  res.status(201).json({ data: { path, fileName: file.originalname } });
}

export async function downloadSubmission(req: Request, res: Response) {
  const r = await record(req, 'submissions', req.params.id);
  if (!r.file_path) throw new ApiError(404, 'NOT_FOUND');
  res.json({
    data: checked(
      await req.db.storage.from('submissions').createSignedUrl(r.file_path, 60, { download: true }),
    ),
  });
}

export async function downloadComplaintAttachment(req: Request, res: Response) {
  const r = await record(req, 'complaints', req.params.id);
  if (!r.attachment_path) throw new ApiError(404, 'NOT_FOUND');
  res.json({
    data: checked(
      await req.db.storage
        .from('complaint-attachments')
        .createSignedUrl(r.attachment_path, 60, { download: true }),
    ),
  });
}
