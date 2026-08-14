/** Carries enough context for the UI to tell "try again" apart from "you can't do that" —
 * a plain Error string loses the HTTP status, so retry affordances can't be shown selectively. */
export class ApiError extends Error {
  status: number;
  kind: "network" | "permission" | "validation" | "server" | "unknown";
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.kind =
      status === 0 ? "network" : status === 401 || status === 403 ? "permission" : status >= 500 ? "server" : "validation";
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Couldn't reach the server — check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body;
}

export type Attachment = { url: string; name: string; type: string; size: number };

export async function uploadFile(file: Blob, filename: string): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file, filename);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
  return body;
}
