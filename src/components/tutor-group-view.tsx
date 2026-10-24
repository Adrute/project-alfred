"use client";
import { apiFetch } from "@/lib/client-api";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { TeacherFeedbackPanel, type TeacherFeedback } from "@/components/teacher-feedback-panel";

interface Agreement { id: string; description: string; status: string; dueDate: string | null }
interface Session {
  id: string; status: string; preparation: string | null; notes: string | null; scheduledAt: string | null;
  createdAt: string; agreements: Agreement[]; teacherFeedbacks: TeacherFeedback[];
}
interface Observation { id: string; category: string; content: string; observedAt: string }
interface TutorStudent {
  id: string; firstName: string; lastName: string; observations: Observation[];
  teacherFeedbacks: TeacherFeedback[]; tutoringSessions: Session[];
}
interface Classroom {
  id: string; name: string; academicYear: string; educationalStage: string; isTutorGroup: boolean;
  tutorNotes?: string | null; enrollments: Array<{ student: TutorStudent }>;
}
interface TutorWorkspace {
  classroom: Classroom | null;
  availableClassrooms: Array<Pick<Classroom, "id" | "name" | "academicYear" | "educationalStage" | "isTutorGroup">>;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, { ...options, headers: { "content-type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

export function TutorGroupView({ onPrompt, onContextChange, initialStudentId, onOpenStudent }: {
  onPrompt: (prompt: string) => void;
  onContextChange?: (context: { summary: string; studentId?: string; studentName?: string }) => void;
  initialStudentId?: string;
  onOpenStudent?: (studentId: string) => void;
}) {
  const [data, setData] = useState<TutorWorkspace>();
  const [classroomId, setClassroomId] = useState("");
  const [studentId, setStudentId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [agreement, setAgreement] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await requestJson<TutorWorkspace>("/api/tutor-group");
    setData(result);
    setClassroomId(result.classroom?.id ?? result.availableClassrooms[0]?.id ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    void requestJson<TutorWorkspace>("/api/tutor-group").then((result) => {
      if (active) {
        setData(result);
        setClassroomId(result.classroom?.id ?? result.availableClassrooms[0]?.id ?? "");
      }
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar la tutoría.");
    });
    return () => { active = false; };
  }, []);

  const students = useMemo(() => data?.classroom?.enrollments.map((item) => item.student) ?? [], [data]);
  const requestedStudentId = studentId ?? initialStudentId;
  const activeStudentId = requestedStudentId && students.some((item) => item.id === requestedStudentId) ? requestedStudentId : students[0]?.id;
  const student = students.find((item) => item.id === activeStudentId);
  const activeSessionId = sessionId && student?.tutoringSessions.some((item) => item.id === sessionId) ? sessionId : student?.tutoringSessions[0]?.id;
  const session = student?.tutoringSessions.find((item) => item.id === activeSessionId);
  const notes = session ? (notesDrafts[session.id] ?? session.notes ?? "") : "";

  useEffect(() => {
    if (!data?.classroom) return;
    onContextChange?.({
      summary: `Mi tutoría es ${data.classroom.name}, con ${students.length} alumnos.${student ? ` Alumno visible: ${student.firstName} ${student.lastName}, con ${student.observations.length} observaciones, ${student.teacherFeedbacks.length} comentarios docentes y ${student.tutoringSessions.length} reuniones tutoriales.` : ""}`,
      studentId: student?.id,
      studentName: student ? `${student.firstName} ${student.lastName}` : undefined,
    });
  }, [data, onContextChange, student, students.length]);

  const configure = async (event: FormEvent) => {
    event.preventDefault();
    if (!classroomId) return;
    setBusy(true); setMessage("");
    try {
      setData(await requestJson<TutorWorkspace>("/api/tutor-group", { method: "PUT", body: JSON.stringify({ classroomId }) }));
      setStudentId(undefined); setSessionId(undefined); setMessage("Tutoría configurada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo configurar."); }
    finally { setBusy(false); }
  };

  const saveSession = async (status?: "completed") => {
    if (!session) return;
    setBusy(true); setMessage("");
    try {
      await requestJson(`/api/tutorings/${session.id}`, { method: "PATCH", body: JSON.stringify({ notes, ...(status ? { status } : {}) }) });
      await load(); setMessage(status ? "Reunión marcada como realizada." : "Notas guardadas.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };

  const addAgreement = async () => {
    if (!session || !agreement.trim()) return;
    setBusy(true); setMessage("");
    try {
      await requestJson(`/api/tutorings/${session.id}/agreements`, { method: "POST", body: JSON.stringify({ description: agreement }) });
      setAgreement(""); await load(); setMessage("Acuerdo añadido.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo añadir el acuerdo."); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="teaching-loading">Preparando tu tutoría…</div>;
  if (!data.classroom) return <div className="tutor-setup">
    <p className="eyebrow">Tutoría de grupo</p><h2>¿De qué grupo eres tutora?</h2>
    <p>Este espacio estará separado de las asignaturas que impartes y reunirá el seguimiento general, las familias y los acuerdos.</p>
    <form onSubmit={(event) => void configure(event)}><select value={classroomId} onChange={(event) => setClassroomId(event.target.value)}>{data.availableClassrooms.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.academicYear}</option>)}</select><button disabled={busy || !classroomId}>Configurar mi tutoría</button></form>
    {message && <small>{message}</small>}
  </div>;

  const pendingAgreements = students.flatMap((item) => item.tutoringSessions.flatMap((meeting) => meeting.agreements)).filter((item) => item.status === "pending").length;
  const meetings = students.reduce((sum, item) => sum + item.tutoringSessions.length, 0);

  return <div className="tutor-page">
    <section className="tutor-hero">
      <div><p className="eyebrow">Mi tutoría</p><h2>{data.classroom.name}</h2><p>{data.classroom.educationalStage} · {data.classroom.academicYear}</p></div>
      <div className="tutor-hero-metrics"><div><strong>{students.length}</strong><small>alumnos</small></div><div><strong>{meetings}</strong><small>reuniones</small></div><div><strong>{pendingAgreements}</strong><small>acuerdos pendientes</small></div></div>
      <form onSubmit={(event) => void configure(event)}><label>Cambiar grupo tutor<select value={classroomId} onChange={(event) => setClassroomId(event.target.value)}>{data.availableClassrooms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button disabled={busy}>Aplicar</button></form>
    </section>
    <div className="tutor-workspace">
      <aside className="tutor-roster"><header><div><p className="eyebrow">Seguimiento del grupo</p><h3>Alumnado</h3></div></header>{students.map((item) => <button key={item.id} className={activeStudentId === item.id ? "selected" : ""} onClick={() => { setStudentId(item.id); setSessionId(undefined); setAgreement(""); setMessage(""); }}><span>{item.firstName[0]}{item.lastName[0]}</span><div><strong>{item.firstName} {item.lastName}</strong><small>{item.teacherFeedbacks.length} comentarios · {item.tutoringSessions.length} reuniones</small></div><b>→</b></button>)}</aside>
      <main className="tutor-student-detail">{student ? <>
        <header><div><p className="eyebrow">Ficha tutorial</p><h2>{student.firstName} {student.lastName}</h2></div><div className="tutor-head-actions">{onOpenStudent && <button className="context-link-button" onClick={() => onOpenStudent(student.id)}>Ver ficha general →</button>}<button onClick={() => onPrompt(`Prepárame una tutoría con la familia de ${student.firstName} ${student.lastName}`)}>✦ Preparar reunión</button></div></header>

        <TeacherFeedbackPanel key={student.id} studentId={student.id} feedbacks={student.teacherFeedbacks} onChanged={load} onSessionSelected={setSessionId} />

        <section className="tutor-observations"><h3>Seguimiento general</h3>{student.observations.length ? student.observations.map((item) => <article key={item.id}><span>{item.category.replaceAll("_", " ")}</span><p>{item.content}</p><small>{new Date(item.observedAt).toLocaleDateString("es-ES")}</small></article>) : <p className="quiet-copy">No hay observaciones generales registradas.</p>}</section>
        <section className="family-meetings">
          <div className="section-heading"><div><p className="eyebrow">Familias</p><h3>Reuniones y acuerdos</h3></div></div>
          {student.tutoringSessions.length ? <div className="meeting-tabs">{student.tutoringSessions.map((item) => <button className={activeSessionId === item.id ? "selected" : ""} key={item.id} onClick={() => { setSessionId(item.id); setAgreement(""); }}>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString("es-ES") : "Próxima tutoría"} · {item.status}</button>)}</div> : <p className="quiet-copy">Todavía no hay reuniones preparadas.</p>}
          {session && <div className="meeting-editor">
            {session.teacherFeedbacks.length > 0 && <div className="meeting-feedback-brief"><h4>Comentarios preparados para comunicar</h4>{session.teacherFeedbacks.map((feedback) => <blockquote key={feedback.id}><strong>{feedback.subject ?? "Comentario general"}</strong><p>{feedback.familyVersion}</p></blockquote>)}</div>}
            {session.preparation && <details><summary>Ver preparación completa</summary><pre>{session.preparation}</pre></details>}
            <label>Notas de la reunión<textarea value={notes} onChange={(event) => setNotesDrafts((current) => ({ ...current, [session.id]: event.target.value }))} placeholder="Conclusiones de la reunión…" /></label>
            <div className="meeting-actions"><button disabled={busy} onClick={() => void saveSession()}>Guardar notas</button><button disabled={busy} onClick={() => void saveSession("completed")}>Marcar realizada</button></div>
            <div className="meeting-agreements"><h4>Acuerdos</h4>{session.agreements.map((item) => <p key={item.id}>✓ {item.description}</p>)}<div><input value={agreement} onChange={(event) => setAgreement(event.target.value)} placeholder="Nuevo acuerdo…" /><button disabled={busy || !agreement.trim()} onClick={() => void addAgreement()}>Añadir</button></div></div>
          </div>}
        </section>
        {message && <p className="save-message" role="status">{message}</p>}
      </> : <p>Este grupo todavía no tiene alumnos.</p>}</main>
    </div>
  </div>;
}
