import { object, text } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const token = () => {
  try {
    return localStorage.getItem('token') ?? '';
  } catch {
    return '';
  }
};
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const value = object(error);
  if (value.detail) return errorMessage(value.detail);
  if (value.error) return errorMessage(value.error);
  if (value.message) return text(value.message);
  if (value.content) return errorMessage(value.content);
  if (Array.isArray(error)) return error.map(errorMessage).join('; ');
  return 'The request could not be completed. Please try again.';
}
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/v1/auths') && path !== '/api/config')
      window.dispatchEvent(new Event('studio:session-expired'));
    const details: unknown = await response
      .json()
      .catch(() => ({ detail: `Request failed (${response.status})` }));
    throw new ApiError(errorMessage(details), response.status, details);
  }
  return response;
}
export async function api<T>(path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
  const response = await request(path, {
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
    ...options,
  });
  return decodeJSON<T>(response);
}
export const remove = <T>(path: string) => api<T>(path, undefined, { method: 'DELETE' });
export const segment = (value: string) => encodeURIComponent(value);
export async function upload(file: File, process = true) {
  const body = new FormData();
  body.set('file', file);
  const result = await (
    await request(`/api/v1/files/?process=${process}&process_in_background=false`, {
      method: 'POST',
      body,
    })
  ).json();
  if (object(result.data).status === 'failed')
    throw new Error(errorMessage(object(result.data).error));
  return result;
}
export function download(name: string, data: unknown, type = 'application/json') {
  const url = URL.createObjectURL(
    new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function decodeJSON<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
    return (await response.text())
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line)) as T;
  }
  return response.json() as Promise<T>;
}
