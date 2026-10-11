export type RequestResult<T> = { ok: true; body: T } | { ok: false; error: string };

/**
 * Sends a request and reads the JSON reply without ever throwing: network failures, HTML error pages
 * (gateway errors, timeouts) and server errors all come back as a message the coordinator can act on.
 */
export async function requestJson<T>(url: string, init: RequestInit, action: string): Promise<RequestResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, error: `Couldn't ${action}: no connection to Trialo. Check your internet connection and try again.` };
  }
  let body: unknown = null;
  try { body = await response.json(); } catch { /* not JSON, e.g. a gateway error page */ }
  const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "";
  if (!response.ok) return { ok: false, error: message || `Couldn't ${action} (server error ${response.status}). Please try again.` };
  if (body === null || typeof body !== "object") return { ok: false, error: `Couldn't ${action}: the server sent an unexpected reply. Please try again.` };
  return { ok: true, body: body as T };
}
