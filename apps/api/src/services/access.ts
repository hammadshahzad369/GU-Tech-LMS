import type { Request } from 'express';
import { uuid } from '../schemas/index.js';
import { ApiError, checked } from '../utils/errors.js';
export async function courseAccess(req: Request, cid: string, manage = false) {
  uuid.parse(cid);
  const allowed = checked(await req.db.rpc(manage ? 'manage_course' : 'member', { cid }));
  if (!allowed) throw new ApiError(403, 'FORBIDDEN', 'You are not a member of this course.');
}
export async function record(req: Request, table: string, id: string) {
  uuid.parse(id);
  const d = checked(await req.db.from(table).select('*').eq('id', id).maybeSingle());
  if (!d) throw new ApiError(404, 'NOT_FOUND', 'Item not found.');
  return d;
}
