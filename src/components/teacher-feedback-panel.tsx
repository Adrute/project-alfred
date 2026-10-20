"use client";

import { useState, type FormEvent } from "react";

export interface TeacherFeedback {
  id: string;
  teacherName: string | null;
  subject: string | null;
  originalComment: string;
  familyVersion: string | null;
  familyVersionSource: string | null;
  familyVersionStatus: string;
  receivedAt: string;
  tutoringSessionId: string | null;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

export function TeacherFeedbackPanel({ studentId, feedbacks, onChanged, onSessionSelected }: {
  studentId: string;
  feedbacks: TeacherFeedback[];
  onChanged: () => Promise<void>;
  onSessionSelected?: (sessionId: string) => void;
}) {
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [teacherName, setTeacherName] = useState("");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [originalComment, setOriginalComment] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const addTeacherFeedback = async (event: FormEvent) => {
    event.preventDefault();
    if (!originalComment.trim()) return;
    setBusy(true); setMessage("");
    try {
      await requestJson(`/api/students/${studentId}/teacher-feedback`, {
        method: "POST",
        body: JSON.stringify({ teacherName: teacherName.trim() || null, subject: feedbackSubject.trim() || null, originalComment, receivedAt }),
      });
      setTeacherName(""); setFeedbackSubject(""); setOriginalComment("");
      await onChanged();
      setMessage("Comentario guardado. Revisa la propuesta antes de llevarla a la tutoría.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el comentario."); }
    finally { setBusy(false); }
  };

  const saveForTutoring = async (feedback: TeacherFeedback) => {
    const familyVersion = feedbackDrafts[feedback.id] ?? feedback.familyVersion ?? "";
    if (!familyVersion.trim()) return;
    setBusy(true); setMessage("");
    try {
      const result = await requestJson<{ tutoringSession: { id: string } }>(`/api/teacher-feedback/${feedback.id}/confirm`, {
        method: "POST", body: JSON.stringify({ familyVersion }),
      });
      onSessionSelected?.(result.tutoringSession.id);
      await onChanged();
      setMessage("Redacción confirmada y guardada para la próxima tutoría.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo preparar para la tutoría."); }
    finally { setBusy(false); }
  };

  return <section className="teacher-feedback-section">
    <div className="section-heading"><div><p className="eyebrow">Información del equipo docente</p><h3>Comentarios del profesorado</h3></div><p>Pega el texto original. Alfred propondrá una versión para la familia, pero tú decides qué se guarda.</p></div>
    <form className="teacher-feedback-form" onSubmit={(event) => void addTeacherFeedback(event)}>
      <label>Profesor o profesora (opcional)<input value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="Por ejemplo, María" /></label>
      <label>Asignatura o contexto (opcional)<input value={feedbackSubject} onChange={(event) => setFeedbackSubject(event.target.value)} placeholder="Por ejemplo, Matemáticas" /></label>
      <label>Fecha recibida<input type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></label>
      <label className="teacher-feedback-comment">Comentario original<textarea value={originalComment} onChange={(event) => setOriginalComment(event.target.value)} placeholder="Copia aquí el comentario tal y como te lo han transmitido…" /></label>
      <button disabled={busy || originalComment.trim().length < 3}>{busy ? "Preparando…" : "Guardar y preparar para la familia"}</button>
    </form>
    <div className="teacher-feedback-list">{feedbacks.length ? feedbacks.map((feedback) => {
      const confirmed = feedback.familyVersionStatus === "confirmed";
      return <article key={feedback.id} className={confirmed ? "confirmed" : "proposal"}>
        <header><div><strong>{feedback.subject ?? "Comentario general"}</strong><small>{feedback.teacherName ? `${feedback.teacherName} · ` : ""}{new Date(feedback.receivedAt).toLocaleDateString("es-ES")}</small></div><span>{confirmed ? "Guardado para tutoría" : "Pendiente de revisión"}</span></header>
        <div className="feedback-comparison"><div><b>Texto original</b><p>{feedback.originalComment}</p></div><label><b>Versión para leer a la familia</b><textarea disabled={confirmed} value={feedbackDrafts[feedback.id] ?? feedback.familyVersion ?? ""} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [feedback.id]: event.target.value }))} /></label></div>
        <footer><small>{feedback.familyVersionSource}</small>{!confirmed && <button disabled={busy || !(feedbackDrafts[feedback.id] ?? feedback.familyVersion)?.trim()} onClick={() => void saveForTutoring(feedback)}>Confirmar y guardar para la próxima tutoría</button>}</footer>
      </article>;
    }) : <p className="quiet-copy">Todavía no has copiado comentarios de otros profesores.</p>}</div>
    {message && <p className="save-message" role="status">{message}</p>}
  </section>;
}
