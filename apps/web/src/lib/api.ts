// localhost is only a valid fallback in dev (`next dev`, no .env.local
// present yet) — silently falling back to it in a production build is
// exactly how a deployed bundle ends up calling localhost from a real
// browser. Production builds must have NEXT_PUBLIC_API_URL from
// apps/web/.env.production (or a platform env var overriding it); if
// it's somehow still missing, fail loudly at build/module-load time
// instead of shipping a broken bundle.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error(
          'NEXT_PUBLIC_API_URL is not set. Production builds must not fall back to localhost — set it in apps/web/.env.production or as a platform environment variable.',
        );
      })()
    : 'http://localhost:3000');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Thin fetch wrapper: attaches the bearer token, parses JSON, and turns a
// non-2xx response into a thrown ApiError with the backend's message — every
// page in this app calls through here rather than raw `fetch`, so error
// handling and auth headers stay in one place.
export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? message;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
