let token: string | null = null;
export const sessionToken = () => token;
export const setToken = (value: string | null) => {
  token = value;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export type Page<T = any> = {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    nextCursor?: string;
    assignmentCount?: number;
    quizCount?: number;
    itemPage?: number;
  };
};
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<Page<T>> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const r = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  let body;
  try {
    body = await r.json();
  } catch {
    throw new ApiError('The server could not complete this request.', r.status, 'NETWORK_ERROR');
  }
  if (!r.ok)
    throw new ApiError(
      body.error?.message || 'Request failed.',
      r.status,
      body.error?.code || 'ERROR',
    );
  return body;
}
export const send = (path: string, method: string, data: unknown = {}) =>
  api(path, { method, body: JSON.stringify(data) });
export const upload = async (bucket: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api(`/files/${bucket}`, { method: 'POST', body: form });
};
export async function download(path: string) {
  const r = await api(path);
  window.open(r.data.signedUrl, '_blank', 'noopener,noreferrer');
}
