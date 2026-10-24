"use client";
import { apiFetch } from "@/lib/client-api";

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";

interface Subject { id: string; name: string; color: string }
interface Classroom { id: string; name: string }
interface Assignment { id: string; subject: Subject; classroom: Classroom }
interface Content { id: string; title: string; status: string }
interface Unit { id: string; title: string; status: string; contents: Content[] }
interface Activity { id: string; name: string; durationMinutes: number; activityType: string; executionStatus: string }
interface Lesson {
  id: string; date: string; startMinute: number; endMinute: number; title: string; objectives: string;
  materials: string; homework: string | null; status: string; postLessonNotes: string | null;
  teachingAssignment: Assignment; teachingUnit: Unit | null; activities: Activity[];
  timetableSlot: { room: string | null } | null;
}
interface WeekPlan { weekStart: string; weekEnd: string; days: string[]; lessons: Lesson[] }
interface TimetableSlot { id: string; dayOfWeek: number; startMinute: number; endMinute: number; room: string | null; teachingAssignment: Assignment }
interface Timetable { id: string; name: string; slots: TimetableSlot[] }
interface CurriculumAssignment extends Assignment { teachingUnits: Unit[] }
interface PlanningData { plan: WeekPlan; timetables: Timetable[]; assignments: Assignment[]; curriculum: CurriculumAssignment[] }

const statusLabel: Record<string, string> = {
  unplanned: "Sin planificar", planned: "Planificada", taught: "Impartida",
  partially_taught: "Parcial", cancelled: "Cancelada",
};
const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, { ...options, headers: { "content-type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la operación.");
  return body;
}

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function monday(value = new Date()) {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return isoDate(date);
}
function shiftDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return isoDate(date);
}
function timeLabel(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function minutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function parsedList(value: string): string[] { try { const result: unknown = JSON.parse(value); return Array.isArray(result) ? result.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }

async function loadPlanningData(target: string): Promise<PlanningData> {
  const [generated, timetableData, curriculum] = await Promise.all([
    requestJson<{ plan: WeekPlan }>("/api/planning", { method: "POST", body: JSON.stringify({ weekStart: target }) }),
    requestJson<{ timetables: Timetable[]; assignments: Assignment[] }>("/api/planning/timetable"),
    requestJson<CurriculumAssignment[]>("/api/planning/curriculum"),
  ]);
  return { plan: generated.plan, timetables: timetableData.timetables, assignments: timetableData.assignments, curriculum };
}

export function PlanningView({ onPrompt, onContextChange, onOpenTeaching }: { onPrompt: (prompt: string) => void; onContextChange?: (summary: string) => void; onOpenTeaching?: (assignmentId: string) => void }) {
  const [weekStart, setWeekStart] = useState(() => monday());
  const [plan, setPlan] = useState<WeekPlan>();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);

  const applyData = useCallback((result: PlanningData) => {
    setPlan(result.plan); setTimetables(result.timetables); setAssignments(result.assignments); setCurriculum(result.curriculum);
    setSelectedId((current) => current && result.plan.lessons.some((item) => item.id === current) ? current : result.plan.lessons[0]?.id);
  }, []);
  const load = useCallback(async (target: string) => {
    setBusy(true); setError("");
    try {
      applyData(await loadPlanningData(target));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar la planificación."); }
    finally { setBusy(false); }
  }, [applyData]);

  useEffect(() => {
    let active = true;
    void loadPlanningData(weekStart).then((result) => { if (active) applyData(result); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo cargar la planificación."); });
    return () => { active = false; };
  }, [applyData, weekStart]);
  const selected = plan?.lessons.find((lesson) => lesson.id === selectedId);
  const pendingContents = curriculum.reduce((sum, item) => sum + item.teachingUnits.flatMap((unit) => unit.contents).filter((content) => content.status !== "completed").length, 0);

  useEffect(() => {
    if (selected) {
      onContextChange?.(`Planificación semanal. Sesión visible: ${selected.teachingAssignment.subject.name} con ${selected.teachingAssignment.classroom.name}, el ${prettyDate(selected.date.slice(0, 10))}, de ${timeLabel(selected.startMinute)} a ${timeLabel(selected.endMinute)}. Título: ${selected.title}. Estado: ${statusLabel[selected.status] ?? selected.status}.`);
    } else {
      onContextChange?.(`Planificación de la semana ${plan ? `${prettyDate(plan.weekStart)} a ${prettyDate(plan.weekEnd)}` : "actual"}.`);
    }
  }, [onContextChange, plan, selected]);

  const moveWeek = (days: number) => setWeekStart((current) => shiftDays(current, days));
  return <div className="planner-page">
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="planner-toolbar">
      <div className="week-navigation"><button onClick={() => moveWeek(-7)} aria-label="Semana anterior">←</button><button onClick={() => setWeekStart(monday())}>Hoy</button><button onClick={() => moveWeek(7)} aria-label="Semana siguiente">→</button><strong>{plan ? `${prettyDate(plan.weekStart)} — ${prettyDate(plan.weekEnd)}` : "Cargando…"}</strong></div>
      <div><button className="secondary-action" onClick={() => setShowTimetable((value) => !value)}>Configurar horario</button><button className="primary-action" onClick={() => onPrompt("Alfred, organízame la próxima semana")}>✦ Organizar con Alfred</button></div>
    </div>

    {showTimetable && <TimetableEditor timetables={timetables} assignments={assignments} onSaved={() => load(weekStart)} />}

    <section className="planner-summary">
      <article><span>▤</span><div><strong>{plan?.lessons.length ?? 0}</strong><small>sesiones esta semana</small></div></article>
      <article><span>✓</span><div><strong>{plan?.lessons.filter((item) => item.status === "planned").length ?? 0}</strong><small>sesiones planificadas</small></div></article>
      <article><span>○</span><div><strong>{plan?.lessons.filter((item) => item.status === "unplanned").length ?? 0}</strong><small>sin planificar</small></div></article>
      <article><span>◎</span><div><strong>{pendingContents}</strong><small>contenidos pendientes</small></div></article>
    </section>

    <div className="planner-layout">
      <section className="week-board" aria-busy={busy}>
        {(plan?.days ?? Array.from({ length: 5 }, (_, index) => shiftDays(weekStart, index))).map((day, index) => {
          const lessons = plan?.lessons.filter((lesson) => lesson.date.slice(0, 10) === day) ?? [];
          return <div className="day-column" key={day}><header><span>{weekdays[index]}</span><strong>{new Date(`${day}T12:00:00Z`).getUTCDate()}</strong></header><div className="day-lessons">
            {lessons.map((lesson) => <button key={lesson.id} className={`lesson-card ${selectedId === lesson.id ? "selected" : ""}`} style={{ "--subject-color": lesson.teachingAssignment.subject.color } as CSSProperties} onClick={() => setSelectedId(lesson.id)}>
              <time>{timeLabel(lesson.startMinute)}–{timeLabel(lesson.endMinute)}</time><strong>{lesson.teachingAssignment.classroom.name}</strong><span>{lesson.teachingAssignment.subject.name}</span><small>{lesson.title}</small><em className={`lesson-status ${lesson.status}`}>{statusLabel[lesson.status] ?? lesson.status}</em>
            </button>)}
            {!lessons.length && <div className="no-lessons">Sin clases</div>}
          </div></div>;
        })}
      </section>
      <LessonDetail key={selected?.id ?? "none"} lesson={selected} onSaved={() => load(weekStart)} onPlan={() => selected && onPrompt(`Planifica la clase de ${selected.teachingAssignment.subject.name} con ${selected.teachingAssignment.classroom.name} del ${selected.date.slice(0, 10)}`)} onOpenTeaching={onOpenTeaching} />
    </div>
  </div>;
}

function LessonDetail({ lesson, onSaved, onPlan, onOpenTeaching }: { lesson?: Lesson; onSaved: () => Promise<void>; onPlan: () => void; onOpenTeaching?: (assignmentId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [status, setStatus] = useState(lesson?.status ?? "unplanned");
  if (!lesson) return <aside className="lesson-detail"><div className="detail-placeholder">Selecciona una sesión para ver su planificación.</div></aside>;
  const objectives = parsedList(lesson.objectives);
  const materials = parsedList(lesson.materials);
  const save = async (event: FormEvent) => { event.preventDefault(); await requestJson(`/api/planning/lessons/${lesson.id}`, { method: "PATCH", body: JSON.stringify({ title, status }) }); setEditing(false); await onSaved(); };
  return <aside className="lesson-detail">
    <div className="lesson-detail-head"><div><p className="eyebrow">Detalle de sesión</p><h2>{lesson.teachingAssignment.classroom.name}</h2><span>{lesson.teachingAssignment.subject.name} · {prettyDate(lesson.date.slice(0, 10))}</span></div><em className={`lesson-status ${lesson.status}`}>{statusLabel[lesson.status]}</em></div>
    {editing ? <form className="lesson-edit-form" onSubmit={(event) => void save(event)}><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div><button>Guardar cambios</button><button type="button" className="text-button" onClick={() => setEditing(false)}>Cancelar</button></div></form> : <>
      <div className="lesson-topic"><small>{lesson.teachingUnit ? "Unidad activa" : "Contenido principal"}</small><h3>{lesson.title}</h3>{lesson.timetableSlot?.room && <span>⌖ {lesson.timetableSlot.room}</span>}</div>
      <DetailList title="Objetivos" values={objectives} empty="Todavía no se han definido." />
      <div className="lesson-activities"><h3>Actividades <span>{lesson.activities.reduce((sum, item) => sum + item.durationMinutes, 0)} min</span></h3>{lesson.activities.length ? lesson.activities.map((item, index) => <div key={item.id}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.activityType.replaceAll("_", " ")} · {item.executionStatus}</small></span><time>{item.durationMinutes} min</time></div>) : <p>Esta sesión todavía no tiene actividades.</p>}</div>
      <DetailList title="Materiales" values={materials} empty="Sin materiales definidos." />
      <div className="detail-actions"><button onClick={() => { setTitle(lesson.title); setStatus(lesson.status); setEditing(true); }}>Editar sesión</button>{onOpenTeaching && <button onClick={() => onOpenTeaching(lesson.teachingAssignment.id)}>Abrir asignatura →</button>}<button className="primary-action" onClick={onPlan}>✦ Planificar</button></div>
    </>}
  </aside>;
}

function DetailList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <div className="detail-list"><h3>{title}</h3>{values.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>{empty}</p>}</div>;
}

function TimetableEditor({ timetables, assignments, onSaved }: { timetables: Timetable[]; assignments: Assignment[]; onSaved: () => Promise<void> }) {
  const timetable = timetables[0];
  const [form, setForm] = useState({ teachingAssignmentId: assignments[0]?.id ?? "", dayOfWeek: "1", start: "08:00", end: "08:55", room: "" });
  if (!timetable) return <section className="timetable-editor">No hay un horario activo.</section>;
  const selectedAssignmentId = form.teachingAssignmentId || assignments[0]?.id || "";
  const create = async (event: FormEvent) => { event.preventDefault(); await requestJson("/api/planning/timetable", { method: "POST", body: JSON.stringify({ weeklyTimetableId: timetable.id, teachingAssignmentId: selectedAssignmentId, dayOfWeek: Number(form.dayOfWeek), startMinute: minutes(form.start), endMinute: minutes(form.end), activityType: "class", room: form.room || null }) }); await onSaved(); };
  const remove = async (id: string) => { await requestJson(`/api/planning/timetable/${id}`, { method: "DELETE" }); await onSaved(); };
  return <section className="timetable-editor"><div><p className="eyebrow">Horario recurrente</p><h3>{timetable.name}</h3></div><form onSubmit={(event) => void create(event)}><select value={selectedAssignmentId} onChange={(event) => setForm({ ...form, teachingAssignmentId: event.target.value })}>{assignments.map((item) => <option key={item.id} value={item.id}>{item.subject.name} · {item.classroom.name}</option>)}</select><select value={form.dayOfWeek} onChange={(event) => setForm({ ...form, dayOfWeek: event.target.value })}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select><input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })}/><input type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })}/><input placeholder="Aula (opcional)" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })}/><button>Añadir franja</button></form><div className="slot-list">{timetable.slots.map((slot) => <span key={slot.id}><b>{weekdays[slot.dayOfWeek - 1]}</b> {timeLabel(slot.startMinute)} · {slot.teachingAssignment.subject.name} · {slot.teachingAssignment.classroom.name}<button onClick={() => void remove(slot.id)} aria-label="Eliminar franja">×</button></span>)}</div></section>;
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}
