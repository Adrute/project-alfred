"use client";
import { apiFetch } from "@/lib/client-api";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { weightedGradeAverage } from "@/domain/teaching";

interface Student { id: string; firstName: string; lastName: string }
interface Grade { id: string; title: string; assessmentPeriod: string; score: number; maxScore: number; weight: number; assessedAt: string; notes: string | null }
interface RecordItem { id: string; studentId: string; progressStatus: string; participationStatus: string; homeworkStatus: string; teacherNotes: string | null; supportNotes: string | null; grades: Grade[] }
interface Assignment {
  id: string; academicYear: string;
  subject: { id: string; name: string; color: string };
  classroom: { id: string; name: string; enrollments: Array<{ student: Student }> };
  studentRecords: RecordItem[];
  timetableSlots: Array<{ id: string; dayOfWeek: number; startMinute: number; endMinute: number }>;
  teachingUnits: Array<{ id: string; status: string }>;
}

const progressLabels: Record<string, string> = { not_assessed: "Sin valorar", needs_support: "Necesita apoyo", developing: "En progreso", on_track: "Adecuado", advanced: "Avanzado" };
const participationLabels: Record<string, string> = { not_assessed: "Sin valorar", low: "Baja", variable: "Variable", consistent: "Constante", high: "Alta" };
const homeworkLabels: Record<string, string> = { not_assessed: "Sin valorar", behind: "Pendientes", irregular: "Irregular", up_to_date: "Al día" };
const weekdays = ["", "L", "M", "X", "J", "V", "S", "D"];
const timeLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, { ...options, headers: { "content-type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

export function TeachingView({ onPrompt, onContextChange, focus, onOpenStudent }: {
  onPrompt: (prompt: string) => void;
  onContextChange?: (context: { summary: string; studentId?: string; studentName?: string }) => void;
  focus?: { assignmentId?: string; studentId?: string };
  onOpenStudent?: (studentId: string) => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>();
  const [studentId, setStudentId] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [recordDrafts, setRecordDrafts] = useState<Record<string, { progressStatus: string; participationStatus: string; homeworkStatus: string; teacherNotes: string; supportNotes: string }>>({});
  const [gradeForm, setGradeForm] = useState({ title: "", assessmentPeriod: "1.ª evaluación", score: "", maxScore: "10", weight: "1", assessedAt: todayKey(), notes: "" });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await requestJson<Assignment[]>("/api/teaching");
      setAssignments(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar la docencia."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void requestJson<Assignment[]>("/api/teaching").then((result) => { if (active) setAssignments(result); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "No se pudo cargar la docencia."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const defaultAssignmentId = assignments.find((item) => item.classroom.enrollments.length)?.id ?? assignments[0]?.id;
  const requestedAssignmentId = assignmentId ?? focus?.assignmentId;
  const activeAssignmentId = requestedAssignmentId && assignments.some((item) => item.id === requestedAssignmentId) ? requestedAssignmentId : defaultAssignmentId;
  const assignment = assignments.find((item) => item.id === activeAssignmentId);
  const students = useMemo(() => assignment?.classroom.enrollments.map((item) => item.student) ?? [], [assignment]);
  const defaultStudentId = assignment?.studentRecords[0]?.studentId ?? students[0]?.id;
  const requestedStudentId = studentId ?? focus?.studentId;
  const activeStudentId = requestedStudentId && students.some((item) => item.id === requestedStudentId) ? requestedStudentId : defaultStudentId;
  const student = students.find((item) => item.id === activeStudentId);
  const record = assignment?.studentRecords.find((item) => item.studentId === activeStudentId);
  const recordKey = `${assignment?.id ?? "none"}:${student?.id ?? "none"}`;
  const recordForm = recordDrafts[recordKey] ?? {
    progressStatus: record?.progressStatus ?? "not_assessed",
    participationStatus: record?.participationStatus ?? "not_assessed",
    homeworkStatus: record?.homeworkStatus ?? "not_assessed",
    teacherNotes: record?.teacherNotes ?? "",
    supportNotes: record?.supportNotes ?? "",
  };
  const updateRecordForm = (update: Partial<typeof recordForm>) => setRecordDrafts((current) => ({ ...current, [recordKey]: { ...recordForm, ...update } }));

  useEffect(() => {
    if (!assignment) return;
    const studentText = student ? ` Alumno visible: ${student.firstName} ${student.lastName}.` : "";
    onContextChange?.({
      summary: `Ficha docente de ${assignment.subject.name} con ${assignment.classroom.name}.${studentText} Incluye calificaciones y seguimiento específico de esta asignatura.`,
      studentId: student?.id,
      studentName: student ? `${student.firstName} ${student.lastName}` : undefined,
    });
  }, [assignment, onContextChange, student]);

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignment || !student) return;
    setBusy(true); setMessage("");
    try {
      await requestJson("/api/teaching/records", { method: "POST", body: JSON.stringify({ action: "save_record", data: {
        teachingAssignmentId: assignment.id, studentId: student.id, ...recordForm,
        teacherNotes: recordForm.teacherNotes || null, supportNotes: recordForm.supportNotes || null,
      }}) });
      setMessage("Seguimiento guardado."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };

  const addGrade = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignment || !student) return;
    setBusy(true); setMessage("");
    try {
      await requestJson("/api/teaching/records", { method: "POST", body: JSON.stringify({ action: "add_grade", data: {
        teachingAssignmentId: assignment.id, studentId: student.id, title: gradeForm.title,
        assessmentPeriod: gradeForm.assessmentPeriod, score: Number(gradeForm.score), maxScore: Number(gradeForm.maxScore),
        weight: Number(gradeForm.weight), assessedAt: gradeForm.assessedAt, notes: gradeForm.notes || null,
      }}) });
      setGradeForm((current) => ({ ...current, title: "", score: "", notes: "" }));
      setMessage("Calificación añadida."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo añadir la calificación."); }
    finally { setBusy(false); }
  };

  if (busy && !assignments.length) return <div className="teaching-loading">Preparando tus asignaturas…</div>;
  if (!assignments.length) return <div className="teaching-empty"><h2>Aún no hay asignaturas asignadas</h2><p>Configura tu horario docente o cuéntale a Alfred qué asignaturas impartes y con qué grupos.</p><button onClick={() => onPrompt("Quiero configurar las asignaturas, grupos y horario que imparto")}>Configurar con Alfred</button></div>;

  const average = weightedGradeAverage(record?.grades ?? []);
  return <div className="teaching-page">
    <section className="teaching-intro"><div><p className="eyebrow">Docencia</p><h2>Mis asignaturas y grupos</h2><p>Cada ficha conserva el seguimiento académico del alumno únicamente para esa asignatura.</p></div><button onClick={() => onPrompt("Quiero modificar mi horario y las asignaturas que imparto")}>✦ Configurar con Alfred</button></section>
    <div className="assignment-strip">{assignments.map((item) => <button key={item.id} className={activeAssignmentId === item.id ? "selected" : ""} style={{ "--subject-color": item.subject.color } as CSSProperties} onClick={() => { setAssignmentId(item.id); setStudentId(undefined); setMessage(""); }}><i/><div><strong>{item.subject.name}</strong><span>{item.classroom.name}</span></div><small>{item.classroom.enrollments.length} alumnos</small></button>)}</div>
    {assignment && <div className="subject-workspace">
      <aside className="subject-roster"><header><div><p className="eyebrow">{assignment.subject.name}</p><h3>{assignment.classroom.name}</h3></div><span>{students.length}</span></header><div className="subject-schedule">{assignment.timetableSlots.length ? assignment.timetableSlots.map((slot) => <span key={slot.id}>{weekdays[slot.dayOfWeek]} {timeLabel(slot.startMinute)}</span>) : <span>Sin horario</span>}</div><div className="subject-student-list">{students.map((item) => {
        const itemRecord = assignment.studentRecords.find((candidate) => candidate.studentId === item.id);
        const itemAverage = weightedGradeAverage(itemRecord?.grades ?? []);
        return <button key={item.id} className={activeStudentId === item.id ? "selected" : ""} onClick={() => { setStudentId(item.id); setMessage(""); }}><span>{item.firstName[0]}{item.lastName[0]}</span><div><strong>{item.firstName} {item.lastName}</strong><small>{progressLabels[itemRecord?.progressStatus ?? "not_assessed"]}</small></div><b>{itemAverage === null ? "—" : itemAverage.toFixed(1)}</b></button>;
      })}</div></aside>
      <main className="subject-record">{student ? <>
        <header className="subject-record-head"><div><p className="eyebrow">Ficha académica · {assignment.subject.name}</p><h2>{student.firstName} {student.lastName}</h2><span>{assignment.classroom.name} · {assignment.academicYear}</span></div><div className="record-head-actions"><div className="grade-average"><strong>{average === null ? "—" : average.toFixed(1)}</strong><small>media ponderada</small></div>{onOpenStudent && <button className="context-link-button" onClick={() => onOpenStudent(student.id)}>Ver ficha general →</button>}</div></header>
        <form className="tracking-form" onSubmit={(event) => void saveRecord(event)}><div className="tracking-fields"><label>Progreso<select value={recordForm.progressStatus} onChange={(event) => updateRecordForm({ progressStatus: event.target.value })}>{Object.entries(progressLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Participación<select value={recordForm.participationStatus} onChange={(event) => updateRecordForm({ participationStatus: event.target.value })}>{Object.entries(participationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Tareas<select value={recordForm.homeworkStatus} onChange={(event) => updateRecordForm({ homeworkStatus: event.target.value })}>{Object.entries(homeworkLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><div className="tracking-notes"><label>Notas de la asignatura<textarea value={recordForm.teacherNotes} onChange={(event) => updateRecordForm({ teacherNotes: event.target.value })} placeholder="Evolución, fortalezas, dificultades…"/></label><label>Apoyos y próximos pasos<textarea value={recordForm.supportNotes} onChange={(event) => updateRecordForm({ supportNotes: event.target.value })} placeholder="Medidas, adaptaciones o seguimiento…"/></label></div><div className="record-form-footer"><small>{message}</small><button disabled={busy}>Guardar seguimiento</button></div></form>
        <section className="grades-section"><div className="section-heading"><div><p className="eyebrow">Evaluación</p><h3>Calificaciones</h3></div></div>{record?.grades.length ? <div className="grade-list">{record.grades.map((grade) => <article key={grade.id}><div><strong>{grade.title}</strong><small>{grade.assessmentPeriod} · {new Date(grade.assessedAt).toLocaleDateString("es-ES")}</small></div><span>{grade.score}/{grade.maxScore}</span></article>)}</div> : <p className="quiet-copy">Todavía no hay calificaciones en esta asignatura.</p>}
          <form className="grade-form" onSubmit={(event) => void addGrade(event)}><input required placeholder="Actividad o examen" value={gradeForm.title} onChange={(event) => setGradeForm({ ...gradeForm, title: event.target.value })}/><input required placeholder="Evaluación" value={gradeForm.assessmentPeriod} onChange={(event) => setGradeForm({ ...gradeForm, assessmentPeriod: event.target.value })}/><input required type="number" min="0" step="0.1" placeholder="Nota" value={gradeForm.score} onChange={(event) => setGradeForm({ ...gradeForm, score: event.target.value })}/><input required type="number" min="0.1" step="0.1" aria-label="Nota máxima" value={gradeForm.maxScore} onChange={(event) => setGradeForm({ ...gradeForm, maxScore: event.target.value })}/><input type="date" value={gradeForm.assessedAt} onChange={(event) => setGradeForm({ ...gradeForm, assessedAt: event.target.value })}/><button disabled={busy}>+ Añadir</button></form>
        </section>
      </> : <div className="teaching-empty"><p>Este grupo todavía no tiene alumnos.</p></div>}</main>
    </div>}
  </div>;
}
