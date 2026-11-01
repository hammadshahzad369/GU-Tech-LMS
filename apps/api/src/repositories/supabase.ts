import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import '../config/proxy.js';
import { ApiError } from '../utils/errors.js';
export function client(token?: string) {
  if (!env.url || !env.key)
    throw new ApiError(503, 'NOT_CONFIGURED', 'Supabase environment variables are not configured.');
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}
export function adminClient() {
  if (!env.serviceKey)
    throw new ApiError(
      503,
      'ADMIN_NOT_CONFIGURED',
      'Server-side Supabase admin credential is not configured.',
    );
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const camel = (value: unknown): any =>
  Array.isArray(value)
    ? value.map(camel)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
            camel(v),
          ]),
        )
      : value;
export const snake = (value: unknown): any =>
  Array.isArray(value)
    ? value.map(snake)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()),
            snake(v),
          ]),
        )
      : value;
