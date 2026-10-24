"use client";

let sessionCsrf: string | undefined;
export function setSessionCsrf(value: string) { sessionCsrf = value; }
function expiredSession() {
  sessionCsrf = undefined;
  // Reset sensitive React state and router caches when the session expires.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}

/** Session credentials stay in memory; teaching responses never enter browser caches. */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();
  if (options.body != null) headers.set("content-type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!sessionCsrf) {
      const session = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      if (!session.ok) { expiredSession(); throw new Error("Inicia sesión para continuar."); }
      sessionCsrf = (await session.json() as { csrfToken: string }).csrfToken;
    }
    headers.set("x-alfred-csrf", sessionCsrf!);
  }
  const response = await fetch(url, { ...options, headers, cache: "no-store", credentials: "same-origin" });
  if (response.status === 401) expiredSession();
  return response;
}
