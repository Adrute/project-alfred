"use client";

import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ username: data.get("username"), password: data.get("password") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión.");
      // Reset document and router caches after changing identity.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesión."); setBusy(false); }
  }
  return <form onSubmit={(event) => void submit(event)}><label>Usuario<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy} type="submit">{busy ? "Entrando…" : "Entrar"}</button></form>;
}
