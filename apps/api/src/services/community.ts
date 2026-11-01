import type { Request, Response } from 'express';
import { z } from 'zod';
import { camel, snake } from '../repositories/supabase.js';
import { announcement, complaint, pagination, uuid } from '../schemas/index.js';
import { courseAccess, record } from '../services/access.js';
import { ApiError, checked } from '../utils/errors.js';

export async function listAnnouncements(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  let q = req.db
    .from('announcements')
    .select('*', { count: 'exact' })
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  if (req.query.courseId) q = q.eq('course_id', uuid.parse(req.query.courseId));
  const r = await q;
  checked(r);
  const ids = (r.data || []).map((x) => x.id);
  const reads = ids.length
    ? checked(
        await req.db
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', req.user.id)
          .in('announcement_id', ids),
      )
    : [];
  res.json({
    data: camel(
      (r.data || []).map((x) => ({ ...x, is_read: reads.some((y) => y.announcement_id === x.id) })),
    ),
    meta: { ...p, total: r.count },
  });
}

export async function createAnnouncement(req: Request, res: Response) {
  const b = announcement.parse(req.body);
  if (!b.courseId && req.user.role !== 'admin')
    throw new ApiError(403, 'FORBIDDEN', 'Only admins can post globally.');
  if (b.courseId) await courseAccess(req, b.courseId, true);
  res.status(201).json({
    data: camel(
      checked(
        await req.db
          .from('announcements')
          .insert({ ...snake(b), author_id: req.user.id })
          .select()
          .single(),
      ),
    ),
  });
}

export async function markAnnouncementsRead(req: Request, res: Response) {
  const b = z.object({ upTo: z.string().datetime() }).strict().parse(req.body);
  const ids = checked(
    await req.db.from('announcements').select('id').lte('created_at', b.upTo).limit(100),
  );
  if (ids.length)
    checked(
      await req.db
        .from('announcement_reads')
        .upsert(ids.map((x) => ({ user_id: req.user.id, announcement_id: x.id }))),
    );
  res.json({ data: { ok: true } });
}

export async function updateAnnouncement(req: Request, res: Response) {
  const a = await record(req, 'announcements', req.params.id);
  if (req.user.role !== 'admin' && a.author_id !== req.user.id)
    throw new ApiError(403, 'FORBIDDEN');
  const b = announcement.omit({ courseId: true }).partial().parse(req.body);
  res.json({
    data: camel(
      checked(await req.db.from('announcements').update(snake(b)).eq('id', a.id).select().single()),
    ),
  });
}

export async function deleteAnnouncement(req: Request, res: Response) {
  const a = await record(req, 'announcements', req.params.id);
  if (req.user.role !== 'admin' && a.author_id !== req.user.id)
    throw new ApiError(403, 'FORBIDDEN');
  checked(await req.db.from('announcements').delete().eq('id', a.id));
  res.json({ data: { ok: true } });
}

export async function listMessages(req: Request, res: Response) {
  await courseAccess(req, req.params.id);
  const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
  let q = req.db
    .from('chat_messages')
    .select('*')
    .eq('course_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (req.query.before) q = q.lt('created_at', z.string().datetime().parse(req.query.before));
  const d = checked(await q);
  res.json({ data: camel(d.reverse()), meta: { nextCursor: d[0]?.created_at || null } });
}

export async function sendMessage(req: Request, res: Response) {
  await courseAccess(req, req.params.id);
  const b = z
    .object({ body: z.string().trim().min(1).max(2000) })
    .strict()
    .parse(req.body);
  res.status(201).json({
    data: camel(
      checked(
        await req.db
          .from('chat_messages')
          .insert({
            body: b.body,
            course_id: req.params.id,
            sender_id: req.user.id,
            sender_name: req.user.full_name,
            sender_role: req.user.role,
          })
          .select()
          .single(),
      ),
    ),
  });
}

export async function deleteMessage(req: Request, res: Response) {
  checked(await req.db.rpc('delete_message', { mid: uuid.parse(req.params.id) }));
  res.json({ data: { ok: true } });
}

export async function createComplaint(req: Request, res: Response) {
  const b = complaint.extend({ attachmentPath: z.string().max(500).optional() }).parse(req.body);
  if (b.courseId) await courseAccess(req, b.courseId);
  if (b.attachmentPath && !b.attachmentPath.startsWith(req.user.id + '/'))
    throw new ApiError(403, 'FORBIDDEN');
  res.status(201).json({
    data: camel(
      checked(
        await req.db
          .from('complaints')
          .insert({ ...snake(b), raised_by: req.user.id })
          .select()
          .single(),
      ),
    ),
  });
}

export async function listMyComplaints(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('complaints')
    .select('*', { count: 'exact' })
    .eq('raised_by', req.user.id)
    .order('updated_at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function listAdminComplaints(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  let q = req.db
    .from('complaints')
    .select('*,profiles!complaints_raised_by_fkey(full_name)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  if (req.query.status)
    q = q.eq(
      'status',
      z.enum(['open', 'in_review', 'resolved', 'rejected']).parse(req.query.status),
    );
  if (req.query.category) q = q.eq('category', z.string().max(30).parse(req.query.category));
  const r = await q;
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}

export async function resolveComplaint(req: Request, res: Response) {
  const b = z
    .object({
      status: z.enum(['in_review', 'resolved', 'rejected']),
      adminResponse: z.string().max(10000).default(''),
    })
    .strict()
    .parse(req.body);
  if (b.status !== 'in_review' && !b.adminResponse.trim())
    throw new ApiError(422, 'RESPONSE_REQUIRED', 'Please provide a response.');
  res.json({
    data: camel(
      checked(
        await req.db.rpc('resolve_complaint', {
          cid: uuid.parse(req.params.id),
          next_status: b.status,
          response: b.adminResponse,
        }),
      ),
    ),
  });
}

export async function listAuditLog(req: Request, res: Response) {
  const p = pagination.parse(req.query);
  const r = await req.db
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('at', { ascending: false })
    .range((p.page - 1) * p.pageSize, p.page * p.pageSize - 1);
  checked(r);
  res.json({ data: camel(r.data), meta: { ...p, total: r.count } });
}
