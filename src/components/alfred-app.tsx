"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import type { FoundationStatus } from "@/services/foundation-status";
import type { ChatPageContext } from "@/domain/chat";
import { PlanningView } from "@/components/planning-view";
import { AdminView } from "@/components/admin-view";
import { TeachingView } from "@/components/teaching-view";
import { TutorGroupView } from "@/components/tutor-group-view";
import { parseStudentNames } from "@/domain/student-admin";
import { weightedGradeAverage } from "@/domain/teaching";
import { MarkdownMessage, plainMarkdown } from "@/components/markdown-message";

type View = "home" | "chat" | "planning" | "teaching" | "classes" | "students" | "tutoring" | "seating" | "admin";
interface Observation { id: string; content: string; category: string; observedAt: string }
interface SubjectRecord {
  id: string; teachingAssignmentId: string; progressStatus: string; participationStatus: string; homeworkStatus: string;
  teacherNotes: string | null; supportNotes: string | null;
  teachingAssignment: { id: string; subject: { id: string; name: string; color: string }; classroom: { id: string; name: string } };
  grades: Array<{ score: number; maxScore: number; weight: number }>;
}
interface StudentClassroomContext {
  id: string; name: string; isTutorGroup: boolean;
  teachingAssignments: Array<{ id: string; subject: { id: string; name: string; color: string } }>;
}
interface Student { id: string; firstName: string; lastName: string; observations: Observation[]; enrollments: Array<{ classroom: StudentClassroomContext }>; tutoringSessions: Array<{ id: string }>; subjectRecords: SubjectRecord[] }
interface Classroom { id: string; name: string; academicYear: string; educationalStage: string; isTutorGroup: boolean; enrollments: Array<{ student: Student }>; seatingLayouts: Array<{ id: string }> }
interface Agreement { id: string; description: string; status: string; dueDate: string | null }
interface Tutoring { id: string; status: string; preparation: string | null; notes: string | null; createdAt: string; student: Student; agreements: Agreement[] }
interface Assignment { id: string; row: number; column: number; student: Student }
interface Layout { id: string; name: string; rows: number; columns: number; configuration: string; classroom: Classroom; assignments: Assignment[] }
interface DailyLesson {
  id: string; date: string; startMinute: number; endMinute: number; title: string; status: string;
  activities: Array<{ id: string }>;
  timetableSlot: { room: string | null } | null;
  teachingAssignment: { classroom: { id: string; name: string }; subject: { id: string; name: string; color: string } };
}
interface DailyDashboard {
  date: string; timezone: "Europe/Madrid"; lessons: DailyLesson[]; nextLesson: DailyLesson | null;
  tutorings: Array<Tutoring & { scheduledAt: string | null }>;
  observations: Array<Observation & { student: Pick<Student, "id" | "firstName" | "lastName"> }>;
  pendingActions: Array<{ id: string; operation: string; createdAt: string }>;
  dueAgreements: Array<Agreement & { tutoringSession: { student: Pick<Student, "id" | "firstName" | "lastName"> } }>;
}
interface Bootstrap { classrooms: Classroom[]; students: Student[]; tutorings: Tutoring[]; layout: Layout | null; recentExecutions: Array<{ id: string; agentId: string; operation: string; status: string; startedAt: string }>; today: DailyDashboard }
interface Pending { id: string; operation: string; payload: { type: string; content?: string; name?: string }; confirmed?: boolean }
interface ChatMessage { id: string; role: "user" | "assistant"; content: string; agentId?: string; pending?: Pending }
interface ConversationSummary { id: string; title: string; updatedAt: string; messages: Array<{ content: string }>; _count: { messages: number } }
interface ContextualViewState { summary: string; studentId?: string; studentName?: string }
interface ChatGptStatus {
  connected: boolean;
  planEnabled: boolean;
  account: { email?: string; name?: string; picture?: string } | null;
  model: string | null;
  detail: string;
  warning?: string | null;
}

const nav: Array<{ id: View; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Inicio" }, { id: "chat", icon: "✦", label: "Chat con Alfred" },
  { id: "planning", icon: "▤", label: "Planificación" },
  { id: "teaching", icon: "◫", label: "Mis asignaturas" }, { id: "classes", icon: "▦", label: "Grupos" },
  { id: "students", icon: "♙", label: "Alumnos" }, { id: "tutoring", icon: "◷", label: "Mi tutoría" },
  { id: "seating", icon: "▥", label: "Organización del aula" },
  { id: "admin", icon: "⚙", label: "Administración" },
];
function AlfredAvatar({ className = "", size, eager = false }: { className?: string; size: number; eager?: boolean }) {
  return <span className={`alfred-avatar ${className}`} aria-hidden="true"><Image src="/images/alfred-avatar-bellhop.png" alt="" width={size} height={size} sizes={`${size}px`} loading={eager ? "eager" : "lazy"}/></span>;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Error inesperado");
  return body;
}

export function AlfredApp({ initialStatus }: { initialStatus: FoundationStatus }) {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>();
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>();
  const [teachingFocus, setTeachingFocus] = useState<{ assignmentId?: string; studentId?: string }>({});
  const [tutorFocusStudentId, setTutorFocusStudentId] = useState<string>();
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [planningContext, setPlanningContext] = useState("Vista semanal de la planificación docente.");
  const [teachingContext, setTeachingContext] = useState<ContextualViewState>({ summary: "Asignaturas y grupos impartidos por la profesora." });
  const [tutoringContext, setTutoringContext] = useState<ContextualViewState>({ summary: "Grupo tutor y seguimiento tutorial de la profesora." });
  const [adminContext, setAdminContext] = useState("Panel de administración y estado de los siete agentes locales.");
  const [chatGpt, setChatGpt] = useState<ChatGptStatus>({
    connected: initialStatus.ai.connected,
    planEnabled: initialStatus.ai.planEnabled,
    account: null,
    model: initialStatus.ai.model,
    detail: initialStatus.ai.detail,
  });

  const refresh = async () => setData(await jsonFetch<Bootstrap>("/api/bootstrap"));
  useEffect(() => {
    void jsonFetch<Bootstrap>("/api/bootstrap").then(setData);
    void jsonFetch<ChatGptStatus>("/api/auth/chatgpt").then(setChatGpt);
    void jsonFetch<{ conversation: { id: string; messages: ChatMessage[] } | null; conversations: ConversationSummary[] }>("/api/chat").then((result) => {
      setConversations(result.conversations);
      if (result.conversation) { setConversationId(result.conversation.id); setMessages(result.conversation.messages); }
    });
    const parameters = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (parameters.get("chatgpt") === "error") setError(parameters.get("reason") ?? "No se pudo conectar ChatGPT.");
      if (parameters.has("chatgpt")) window.history.replaceState({}, "", window.location.pathname);
    });
  }, []);

  const disconnectChatGpt = async () => {
    try {
      const status = await jsonFetch<ChatGptStatus>("/api/auth/chatgpt", { method: "DELETE" });
      setChatGpt(status);
      if (status.warning) setError(status.warning);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cerrar la sesión de ChatGPT.");
    }
  };

  const filteredStudents = useMemo(() => (data?.students ?? []).filter((student) =>
    `${student.firstName} ${student.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()),
  ), [data, studentSearch]);
  const selectedStudent = data?.students.find((student) => student.id === selectedStudentId) ?? filteredStudents[0];
  const selectedClassroom = data?.classrooms.find((classroom) => classroom.id === selectedClassroomId);
  const selectedSeatAssignments = useMemo(() => data?.layout?.assignments.filter((assignment) => selectedSeats.includes(assignment.id)) ?? [], [data, selectedSeats]);
  const pageContext = useMemo<ChatPageContext>(() => {
    const label = nav.find((item) => item.id === view)?.label ?? "Alfred";
    if (view === "home") return {
      view, label,
      summary: data?.today
        ? `Trabajo de hoy, ${prettyHomeDate(data.today.date)}: ${data.today.lessons.length} clases (${data.today.lessons.filter((lesson) => lesson.status === "unplanned").length} sin planificar), ${data.today.tutorings.length} tutorías, ${data.today.pendingActions.length} propuestas pendientes de confirmar. Agenda: ${data.today.lessons.map((lesson) => `${minuteLabel(lesson.startMinute)} ${lesson.teachingAssignment.subject.name} con ${lesson.teachingAssignment.classroom.name}`).join("; ") || "sin clases programadas"}.`
        : "Panel de trabajo del día cargando.",
      studentIds: [], studentNames: [],
    };
    if (view === "students" && selectedStudent) return {
      view, label,
      summary: `Ficha visible de ${selectedStudent.firstName} ${selectedStudent.lastName}, del grupo ${selectedStudent.enrollments[0]?.classroom.name ?? "sin grupo"}, con ${selectedStudent.observations.length} observaciones registradas.`,
      studentIds: [selectedStudent.id], studentNames: [`${selectedStudent.firstName} ${selectedStudent.lastName}`],
    };
    if (view === "tutoring") return { view, label, summary: tutoringContext.summary, studentIds: tutoringContext.studentId ? [tutoringContext.studentId] : [], studentNames: tutoringContext.studentName ? [tutoringContext.studentName] : [] };
    if (view === "seating") return {
      view, label,
      summary: data?.layout
        ? `Distribución ${data.layout.name} de ${data.layout.classroom.name}${selectedSeatAssignments.length ? `; pupitres seleccionados: ${selectedSeatAssignments.map((item) => `${item.student.firstName} ${item.student.lastName}`).join(" y ")}` : ""}.`
        : "Organización del aula sin una distribución guardada.",
      studentIds: selectedSeatAssignments.map((item) => item.student.id),
      studentNames: selectedSeatAssignments.map((item) => `${item.student.firstName} ${item.student.lastName}`),
    };
    if (view === "planning") return { view, label, summary: planningContext, studentIds: [], studentNames: [] };
    if (view === "teaching") return { view, label, summary: teachingContext.summary, studentIds: teachingContext.studentId ? [teachingContext.studentId] : [], studentNames: teachingContext.studentName ? [teachingContext.studentName] : [] };
    if (view === "classes") return {
      view, label,
      summary: selectedClassroom
        ? `Detalle visible de ${selectedClassroom.name}, curso ${selectedClassroom.academicYear}, con ${selectedClassroom.enrollments.length} alumnos matriculados.`
        : `Listado de ${data?.classrooms.length ?? 0} clases activas con sus matrículas.`,
      studentIds: selectedClassroom?.enrollments.map((item) => item.student.id) ?? [],
      studentNames: selectedClassroom?.enrollments.map((item) => `${item.student.firstName} ${item.student.lastName}`) ?? [],
    };
    if (view === "admin") return { view, label, summary: adminContext, studentIds: [], studentNames: [] };
    return { view, label, summary: "Conversación activa con Alfred.", studentIds: [], studentNames: [] };
  }, [adminContext, data, planningContext, selectedClassroom, selectedSeatAssignments, selectedStudent, teachingContext, tutoringContext, view]);

  const sendMessage = async (preset?: string, navigateToChat = true) => {
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    setInput(""); setError(""); setBusy(true);
    if (navigateToChat) setView("chat");
    setMessages((items) => [...items, { id: `local-${Date.now()}`, role: "user", content: text }]);
    try {
      const result = await jsonFetch<{ conversationId: string; message: ChatMessage; pendingAction: Pending | null }>("/api/chat", {
        method: "POST", body: JSON.stringify({ conversationId, message: text, pageContext }),
      });
      setConversationId(result.conversationId);
      setMessages((items) => [...items, { ...result.message, pending: result.pendingAction ?? undefined }]);
      const list = await jsonFetch<{ conversations: ConversationSummary[] }>(`/api/chat?conversationId=${result.conversationId}`);
      setConversations(list.conversations);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo enviar."); }
    finally { setBusy(false); }
  };

  const confirm = async (messageId: string, pending: Pending) => {
    setBusy(true); setError("");
    try {
      await jsonFetch(`/api/actions/${pending.id}/confirm`, { method: "POST" });
      setMessages((items) => items.map((item) => item.id === messageId ? { ...item, pending: { ...pending, confirmed: true } } : item));
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo confirmar."); }
    finally { setBusy(false); }
  };

  const selectConversation = async (id: string) => {
    if (busy || id === conversationId) return;
    setBusy(true); setError("");
    try {
      const result = await jsonFetch<{ conversation: { id: string; messages: ChatMessage[] } | null; conversations: ConversationSummary[] }>(`/api/chat?conversationId=${id}`);
      if (result.conversation) { setConversationId(result.conversation.id); setMessages(result.conversation.messages); }
      setConversations(result.conversations);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo abrir la conversación."); }
    finally { setBusy(false); }
  };
  const refreshAfterDatabaseChange = async () => {
    await refresh();
    const result = await jsonFetch<{ conversation: { id: string; messages: ChatMessage[] } | null; conversations: ConversationSummary[] }>("/api/chat");
    setConversations(result.conversations);
    setConversationId(result.conversation?.id);
    setMessages(result.conversation?.messages ?? []);
  };
  const openStudentProfile = (studentId: string) => {
    setSelectedStudentId(studentId);
    setView("students");
  };
  const openClassroom = (classroomId: string) => {
    setSelectedClassroomId(classroomId);
    setView("classes");
  };
  const openTeachingContext = (assignmentId: string, studentId?: string) => {
    setTeachingFocus({ assignmentId, studentId });
    setView("teaching");
  };
  const openTutorContext = (studentId: string) => {
    setTutorFocusStudentId(studentId);
    setView("tutoring");
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><AlfredAvatar className="sidebar-brand-avatar" size={38}/><div><strong>Alfred</strong><small>Asistente docente</small></div></div>
      <nav>{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><i>{item.icon}</i>{item.label}</button>)}</nav>
      <div className="local-card"><span className="status-dot is-ready"/><div><strong>Datos locales</strong><small>{chatGpt.planEnabled ? "GPT activo · nombres protegidos" : "Modo manual · SQLite"}</small></div></div>
      <div className="teacher-card"><div className="teacher-avatar">P</div><div><strong>Profesora</strong><small>Curso 2026–2027</small></div></div>
    </aside>
    <main className="workspace">
      <header className="workspace-header"><div><p className="eyebrow">{nav.find((item) => item.id === view)?.label}</p><h1>{view === "home" ? "Tu día" : nav.find((item) => item.id === view)?.label}</h1></div><div className="header-actions"><ChatGptControl status={chatGpt} disconnect={disconnectChatGpt}/><span>{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span><button onClick={() => void refresh()} aria-label="Actualizar datos">↻</button></div></header>
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
      {view === "home" && <HomeView data={data} onNavigate={setView} onPrompt={(prompt) => void sendMessage(prompt)} />}
      {view === "chat" && <ChatView aiStatus={chatGpt} messages={messages} conversations={conversations} conversationId={conversationId} input={input} setInput={setInput} busy={busy} sendMessage={sendMessage} confirm={confirm} selectConversation={selectConversation} newConversation={() => { setMessages([]); setConversationId(undefined); setInput(""); }} />}
      {view === "planning" && <PlanningView onPrompt={(prompt) => void sendMessage(prompt)} onContextChange={setPlanningContext} onOpenTeaching={(assignmentId) => openTeachingContext(assignmentId)} />}
      {view === "teaching" && <TeachingView onPrompt={(prompt) => void sendMessage(prompt)} onContextChange={setTeachingContext} focus={teachingFocus} onOpenStudent={openStudentProfile} />}
      {view === "classes" && <ClassesView data={data} refresh={refresh} selectedId={selectedClassroomId} select={setSelectedClassroomId} openStudent={openStudentProfile} />}
      {view === "students" && <StudentsView students={filteredStudents} classrooms={data?.classrooms ?? []} selected={selectedStudent} search={studentSearch} setSearch={setStudentSearch} select={setSelectedStudentId} refresh={refresh} openTeaching={openTeachingContext} openTutor={openTutorContext} openClassroom={openClassroom} />}
      {view === "tutoring" && <TutorGroupView onPrompt={(prompt) => void sendMessage(prompt)} onContextChange={setTutoringContext} initialStudentId={tutorFocusStudentId} onOpenStudent={openStudentProfile} />}
      {view === "seating" && <SeatingView layout={data?.layout ?? null} selected={selectedSeats} setSelected={setSelectedSeats} refresh={refresh} generate={() => void sendMessage("Organiza los 25 alumnos en cinco filas de cinco")}/>}
      {view === "admin" && <AdminView onContextChange={setAdminContext} onDataChanged={refreshAfterDatabaseChange} />}
    </main>
    <FloatingAlfred
      open={assistantOpen}
      setOpen={setAssistantOpen}
      context={pageContext}
      messages={messages}
      busy={busy}
      confirm={confirm}
      onSend={(message) => sendMessage(message, false)}
      onOpenChat={() => { setAssistantOpen(false); setView("chat"); }}
      onNewConversation={() => { setMessages([]); setConversationId(undefined); setInput(""); }}
      aiStatus={chatGpt}
    />
  </div>;
}

function FloatingAlfred({ open, setOpen, context, messages, busy, confirm, onSend, onOpenChat, onNewConversation, aiStatus }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  context: ChatPageContext;
  messages: ChatMessage[];
  busy: boolean;
  confirm: (id: string, pending: Pending) => Promise<void>;
  onSend: (message: string) => Promise<void>;
  onOpenChat: () => void;
  onNewConversation: () => void;
  aiStatus: ChatGptStatus;
}) {
  const [value, setValue] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && messageListRef.current) messageListRef.current.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "auto" });
  }, [busy, messages.length, open]);
  const send = () => {
    const message = value.trim();
    if (!message || busy) return;
    setValue("");
    void onSend(message);
  };
  if (!open) return <button className="floating-alfred-trigger" onClick={() => setOpen(true)} aria-label="Abrir Alfred" title="Hablar con Alfred">
    <AlfredAvatar size={82}/>
  </button>;
  return <section className="floating-alfred-panel" aria-label="Alfred, asistente contextual">
    <header>
      <AlfredAvatar size={48}/>
      <div><strong>Alfred</strong><small><span/> {aiStatus.planEnabled ? "Usando tu plan de ChatGPT" : "Modo manual"}</small></div>
      <div className="floating-alfred-actions"><button onClick={onNewConversation} aria-label="Nueva conversación">＋</button><button onClick={() => setOpen(false)} aria-label="Cerrar Alfred">×</button></div>
    </header>
    <button className="floating-context" onClick={onOpenChat} title="Abrir el chat completo"><span>Viendo</span><strong>{context.label}</strong><i>↗</i></button>
    <div className="floating-messages" ref={messageListRef}>
      {messages.length === 0 && <div className="floating-welcome"><AlfredAvatar size={70}/><h2>Estoy contigo</h2><p>Veo que estás en <strong>{context.label}</strong>. Pregúntame por lo que aparece aquí o por cualquier otra cosa.</p></div>}
      {messages.map((message) => <div className={`floating-message ${message.role}`} key={message.id}>
        {message.role === "assistant" && <AlfredAvatar size={25}/>}<div>{message.role === "assistant" ? <MarkdownMessage content={message.content}/> : <div className="message-text">{message.content}</div>}{message.pending && <div className={`confirmation-card ${message.pending.confirmed ? "done" : ""}`}><div><strong>{message.pending.confirmed ? "Acción confirmada" : "Pendiente de confirmación"}</strong><small>{message.pending.operation.replaceAll("_", " ")}</small></div>{message.pending.confirmed ? <span>✓ Guardado</span> : <button disabled={busy} onClick={() => void confirm(message.id, message.pending!)}>Confirmar</button>}</div>}</div>
      </div>)}
      {busy && <div className="floating-message assistant"><AlfredAvatar size={25}/><div className="typing"><i/><i/><i/></div></div>}
    </div>
    <form className="floating-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
      <textarea disabled={busy} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Pregunta sobre esta pantalla…" aria-label="Mensaje para Alfred"/>
      <button disabled={busy || !value.trim()} aria-label="Enviar mensaje">↑</button>
    </form>
    <small className="floating-disclaimer">{aiStatus.planEnabled ? "Nombres seudonimizados localmente · " : "Contexto local · "}revisa las propuestas antes de confirmarlas</small>
  </section>;
}

function ChatGptControl({ status, disconnect }: { status: ChatGptStatus; disconnect: () => Promise<void> }) {
  if (!status.planEnabled) return <a className="chatgpt-connect" href="/api/auth/chatgpt/start"><span>✦</span> Continuar con ChatGPT</a>;
  return <div className="chatgpt-connected" title={status.detail}><span>✦</span><div><strong>ChatGPT activo</strong><small>{status.account?.email ?? status.model ?? "Plan conectado"}</small></div><button onClick={() => void disconnect()} title="Desconectar ChatGPT">×</button></div>;
}

function minuteLabel(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function prettyHomeDate(value: string, includeYear = false) {
  const formatted = new Date(`${value.slice(0, 10)}T12:00:00.000Z`).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", ...(includeYear ? { year: "numeric" as const } : {}), timeZone: "UTC",
  });
  return formatted.charAt(0).toLocaleUpperCase("es") + formatted.slice(1);
}

const lessonStatus: Record<string, string> = {
  unplanned: "Sin planificar", planned: "Preparada", taught: "Impartida",
  partially_taught: "Parcial", cancelled: "Cancelada",
};

const pendingActionLabel: Record<string, string> = {
  record_observation: "Revisar una observación", save_tutoring: "Confirmar una tutoría",
  save_layout: "Confirmar una distribución", create_classroom: "Confirmar una clase",
  create_student: "Confirmar un alumno", create_students_bulk: "Confirmar varios alumnos",
  create_teaching_schedule: "Confirmar un horario", plan_week: "Confirmar la planificación",
};

function HomeView({ data, onNavigate, onPrompt }: { data: Bootstrap | null; onNavigate: (view: View) => void; onPrompt: (value: string) => void }) {
  const today = data?.today;
  const lessons = today?.lessons ?? [];
  const unplanned = lessons.filter((lesson) => lesson.status === "unplanned");
  const actionableCount = unplanned.length + (today?.pendingActions.length ?? 0) + (today?.dueAgreements.length ?? 0);
  const next = today?.nextLesson;
  const firstUnplanned = unplanned[0];

  return <div className="view-stack today-dashboard">
    <section className="daily-briefing">
      <div>
        <p className="eyebrow">Resumen diario</p>
        <h2>{today ? prettyHomeDate(today.date) : "Preparando tu jornada…"}</h2>
        <p>{lessons.length
          ? `Tienes ${lessons.length} ${lessons.length === 1 ? "clase" : "clases"} hoy${unplanned.length ? ` y ${unplanned.length} aún ${unplanned.length === 1 ? "necesita" : "necesitan"} preparación` : ". Todo está preparado"}.`
          : "No tienes clases programadas hoy. Puedes aprovechar para adelantar la siguiente sesión."}</p>
        <div className="daily-briefing-actions"><button onClick={() => onPrompt("Alfred, hazme un resumen de lo que tengo hoy y ayúdame a priorizar")}>✦ Organizar el día con Alfred</button><button className="ghost" onClick={() => onNavigate("planning")}>Ver planificación</button></div>
      </div>
      <AlfredAvatar className="orb hero-avatar" size={104} eager/>
    </section>

    <section className="metric-grid daily-metrics">
      <article><span>▤</span><div><strong>{today ? lessons.length : "—"}</strong><small>Clases de hoy</small></div></article>
      <article className={unplanned.length ? "needs-attention" : ""}><span>○</span><div><strong>{today ? unplanned.length : "—"}</strong><small>Sin planificar</small></div></article>
      <article><span>◷</span><div><strong>{today?.tutorings.length ?? (today ? 0 : "—")}</strong><small>Tutorías de hoy</small></div></article>
      <article className={actionableCount ? "needs-attention" : ""}><span>✓</span><div><strong>{today ? actionableCount : "—"}</strong><small>Pendientes ahora</small></div></article>
    </section>

    <div className="today-layout">
      <section className="today-panel agenda-panel">
        <div className="section-heading"><div><p className="eyebrow">Horario</p><h3>Agenda de hoy</h3></div><button className="text-action" onClick={() => onNavigate("planning")}>Abrir semana →</button></div>
        {lessons.length ? <div className="daily-timeline">{lessons.map((lesson) => <article className="daily-lesson" key={lesson.id}>
          <div className="lesson-time"><strong>{minuteLabel(lesson.startMinute)}</strong><span>{minuteLabel(lesson.endMinute)}</span></div>
          <i style={{ background: lesson.teachingAssignment.subject.color }}/>
          <div className="daily-lesson-main"><div><strong>{lesson.teachingAssignment.subject.name}</strong><span>{lesson.teachingAssignment.classroom.name}{lesson.timetableSlot?.room ? ` · ${lesson.timetableSlot.room}` : ""}</span></div><small>{lesson.title}</small></div>
          <div className="daily-lesson-actions"><span className={`lesson-state ${lesson.status}`}>{lessonStatus[lesson.status] ?? lesson.status}</span><button onClick={() => onPrompt(`Ayúdame a preparar la clase de ${lesson.teachingAssignment.subject.name} con ${lesson.teachingAssignment.classroom.name} de hoy`)}>Preguntar a Alfred</button></div>
        </article>)}</div> : <div className="free-day-state"><span>☀</span><div><h4>La agenda de hoy está libre</h4><p>No hay clases ni sesiones programadas para este día.</p></div></div>}

        {!lessons.length && next && <article className="next-lesson-card"><div><p className="eyebrow">Próxima clase</p><strong>{next.teachingAssignment.subject.name} · {next.teachingAssignment.classroom.name}</strong><small>{prettyHomeDate(next.date)} · {minuteLabel(next.startMinute)}–{minuteLabel(next.endMinute)}</small></div><button onClick={() => onPrompt(`Ayúdame a preparar mi próxima clase: ${next.teachingAssignment.subject.name} con ${next.teachingAssignment.classroom.name}`)}>Prepararla con Alfred</button></article>}
        {!lessons.length && today && !next && <article className="next-lesson-card setup-schedule"><div><p className="eyebrow">Horario docente</p><strong>Aún no hay un horario configurado</strong><small>Añádelo para que Inicio pueda anticipar tus próximas clases.</small></div><button onClick={() => onNavigate("planning")}>Configurar horario</button></article>}
      </section>

      <div className="today-side-stack">
        <section className="today-panel task-panel">
          <div className="section-heading"><div><p className="eyebrow">Prioridad</p><h3>Pendientes</h3></div><span className="count-pill">{actionableCount}</span></div>
          {firstUnplanned && <button className="task-row" onClick={() => onPrompt(`Planifica mi clase de ${firstUnplanned.teachingAssignment.subject.name} con ${firstUnplanned.teachingAssignment.classroom.name} de hoy`)}><span>○</span><div><strong>Preparar {firstUnplanned.teachingAssignment.subject.name}</strong><small>{minuteLabel(firstUnplanned.startMinute)} · {firstUnplanned.teachingAssignment.classroom.name}</small></div><b>→</b></button>}
          {today?.pendingActions.map((action) => <button className="task-row" key={action.id} onClick={() => onNavigate("chat")}><span>!</span><div><strong>{pendingActionLabel[action.operation] ?? `Revisar ${action.operation.replaceAll("_", " ")}`}</strong><small>Esperando tu confirmación en el chat</small></div><b>→</b></button>)}
          {today?.dueAgreements.map((agreement) => <button className="task-row" key={agreement.id} onClick={() => onNavigate("tutoring")}><span>✓</span><div><strong>{agreement.description}</strong><small>Acuerdo de {agreement.tutoringSession.student.firstName} {agreement.tutoringSession.student.lastName}</small></div><b>→</b></button>)}
          {today && !actionableCount && <div className="all-clear"><span>✓</span><div><strong>Todo al día</strong><small>No hay nada urgente que revisar.</small></div></div>}
          {!today && <div className="dashboard-skeleton"/>}
        </section>

        <section className="today-panel attention-panel">
          <div className="section-heading"><div><p className="eyebrow">Seguimiento</p><h3>Alumnado hoy</h3></div><button className="text-action" onClick={() => onNavigate("students")}>Ver fichas →</button></div>
          {today?.tutorings.map((tutoring) => <button className="student-touchpoint" key={tutoring.id} onClick={() => onNavigate("tutoring")}><span className="student-avatar">{tutoring.student.firstName[0]}{tutoring.student.lastName[0]}</span><div><strong>Tutoría con {tutoring.student.firstName} {tutoring.student.lastName}</strong><small>{tutoring.scheduledAt ? new Date(tutoring.scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "Hora por concretar"}</small></div></button>)}
          {today?.observations.map((observation) => <button className="student-touchpoint" key={observation.id} onClick={() => onNavigate("students")}><span className="student-avatar">{observation.student.firstName[0]}{observation.student.lastName[0]}</span><div><strong>{observation.student.firstName} {observation.student.lastName}</strong><small>Observación registrada hoy · {observation.category.replaceAll("_", " ")}</small></div></button>)}
          {today && !today.tutorings.length && !today.observations.length && <p className="quiet-copy">No hay tutorías ni observaciones registradas hoy.</p>}
        </section>
      </div>
    </div>

    <section className="day-shortcuts"><div><p className="eyebrow">Acciones rápidas</p><h3>¿Qué necesitas hacer?</h3></div><div>
      <button onClick={() => onPrompt("Quiero registrar una observación sobre un alumno")}><span>＋</span> Registrar observación</button>
      <button onClick={() => onPrompt("Quiero preparar una tutoría")}><span>◷</span> Preparar tutoría</button>
      <button onClick={() => onNavigate("classes")}><span>▦</span> Gestionar clases</button>
    </div></section>
  </div>;
}

function ChatView({ aiStatus, messages, conversations, conversationId, input, setInput, busy, sendMessage, confirm, selectConversation, newConversation }: { aiStatus: ChatGptStatus; messages: ChatMessage[]; conversations: ConversationSummary[]; conversationId?: string; input: string; setInput: (value: string) => void; busy: boolean; sendMessage: (value?: string) => Promise<void>; confirm: (id: string, pending: Pending) => Promise<void>; selectConversation: (id: string) => Promise<void>; newConversation: () => void }) {
  const conversationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = conversationRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "auto" });
  }, [messages.length, busy, conversationId]);
  const submit = (event: FormEvent) => { event.preventDefault(); void sendMessage(); };
  return <div className="chat-hub"><aside className="chat-history"><button className="new-chat" onClick={newConversation}>＋ Nueva conversación</button><div className="chat-history-title"><span>Conversaciones</span><small>{conversations.length}</small></div>{conversations.map((item) => <button className={conversationId === item.id ? "selected" : ""} key={item.id} onClick={() => void selectConversation(item.id)}><span>✦</span><div><strong>{item.title}</strong><small>{item.messages[0]?.content ? plainMarkdown(item.messages[0].content) : "Sin mensajes"}</small><time>{new Date(item.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</time></div></button>)}</aside><div className="chat-page"><section className="conversation" ref={conversationRef}>
    {messages.length === 0 && <div className="chat-empty"><AlfredAvatar className="orb small empty-avatar" size={56}/><h2>Hola, soy Alfred</h2><p>Puedo recordar observaciones, preparar tutorías y organizar tu aula.</p></div>}
    {messages.map((message) => <div className={`chat-row ${message.role}`} key={message.id}>{message.role === "assistant" && <AlfredAvatar className="mini-avatar" size={30}/>}<div className="chat-bubble">{message.role === "assistant" && <small className="agent-label">Alfred</small>}{message.role === "assistant" ? <MarkdownMessage content={message.content}/> : <div className="message-text">{message.content}</div>}{message.pending && <div className={`confirmation-card ${message.pending.confirmed ? "done" : ""}`}><div><strong>{message.pending.confirmed ? "Acción confirmada" : "Pendiente de confirmación"}</strong><small>{message.pending.operation.replaceAll("_", " ")}</small></div>{message.pending.confirmed ? <span>✓ Guardado</span> : <button disabled={busy} onClick={() => void confirm(message.id, message.pending!)}>Confirmar y guardar</button>}</div>}</div></div>)}
    {busy && <div className="chat-row assistant"><AlfredAvatar className="mini-avatar" size={30}/><div className="typing"><i/><i/><i/></div></div>}
  </section><div className="chat-bottom"><div className="prompt-chips">{["¿Qué sabes de Lucas?", "Observaciones de esta semana", "Organiza los asientos"].map((prompt) => <button disabled={busy} onClick={() => void sendMessage(prompt)} key={prompt}>{prompt}</button>)}</div><form className="chat-composer" onSubmit={submit}><textarea disabled={busy} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Escribe a Alfred…"/><button disabled={busy || !input.trim()}>↑</button></form><small>{aiStatus.planEnabled ? `Usando ChatGPT${aiStatus.model ? ` · ${aiStatus.model}` : ""} · los nombres se sustituyen antes de salir del equipo.` : "Modo manual · conecta ChatGPT para activar razonamientos avanzados."} Revisa siempre las propuestas antes de confirmarlas.</small></div></div></div>;
}

function ClassesView({ data, refresh, selectedId, select, openStudent }: { data: Bootstrap | null; refresh: () => Promise<void>; selectedId?: string; select: (id?: string) => void; openStudent: (id: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", academicYear: "2026-2027", educationalStage: "ESO" });
  const create = async (event: FormEvent) => { event.preventDefault(); await jsonFetch("/api/classrooms", { method: "POST", body: JSON.stringify(form) }); setShowForm(false); await refresh(); };
  const selected = data?.classrooms.find((item) => item.id === selectedId);
  if (selected) return <div className="class-detail-page"><button className="back-button" onClick={() => select(undefined)}>← Todas las clases</button><section className="class-detail-head"><div><p className="eyebrow">Clase</p><h2>{selected.name}</h2><p>{selected.educationalStage} · {selected.academicYear}{selected.isTutorGroup ? " · Mi grupo tutor" : ""}</p></div><div className="class-detail-metric"><strong>{selected.enrollments.length}</strong><small>alumnos</small></div></section><div className="class-detail-layout"><section className="class-roster"><div className="section-heading"><div><p className="eyebrow">Matrícula</p><h3>Alumnos de la clase</h3></div></div>{selected.enrollments.length ? <div className="roster-grid">{selected.enrollments.map(({ student }) => <article key={student.id}><button onClick={() => openStudent(student.id)} aria-label={`Abrir ficha de ${student.firstName} ${student.lastName}`}><span className="student-avatar">{student.firstName[0]}{student.lastName[0]}</span><div><strong>{student.firstName} {student.lastName}</strong><small>{student.observations.length} observaciones</small></div><b>→</b></button></article>)}</div> : <Empty text="Todavía no hay alumnos en esta clase."/>}</section><BulkStudentForm classroomId={selected.id} classroomName={selected.name} refresh={refresh}/></div></div>;
  return <div className="view-stack"><div className="toolbar"><p>Selecciona una clase para consultar y editar su matrícula.</p><button onClick={() => setShowForm(!showForm)}>+ Nueva clase</button></div>{showForm && <form className="inline-form" onSubmit={(event) => void create(event)}><input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/><input value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })}/><input value={form.educationalStage} onChange={(event) => setForm({ ...form, educationalStage: event.target.value })}/><button>Crear</button></form>}<div className="class-grid">{data?.classrooms.map((item) => <button className="class-card" key={item.id} onClick={() => select(item.id)}><div className="class-card-top"><span>▦</span><small>{item.academicYear}</small></div><h2>{item.name}</h2><p>{item.educationalStage}</p><div className="class-stats"><strong>{item.enrollments.length}</strong> alumnos <b>·</b> {item.seatingLayouts.length} planos recientes</div><div className="class-card-bottom"><div className="avatar-stack">{item.enrollments.slice(0, 8).map((entry) => <i key={entry.student.id}>{entry.student.firstName[0]}{entry.student.lastName[0]}</i>)}</div><span>Ver clase →</span></div></button>)}</div></div>;
}

function StudentsView({ students, classrooms, selected, search, setSearch, select, refresh, openTeaching, openTutor, openClassroom }: {
  students: Student[]; classrooms: Classroom[]; selected?: Student; search: string;
  setSearch: (value: string) => void; select: (id: string) => void; refresh: () => Promise<void>;
  openTeaching: (assignmentId: string, studentId?: string) => void;
  openTutor: (studentId: string) => void;
  openClassroom: (classroomId: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", classroomId: classrooms[0]?.id ?? "" });
  const create = async (event: FormEvent) => { event.preventDefault(); const classroomId = form.classroomId || classrooms[0]?.id; if (!classroomId) return; await jsonFetch("/api/students", { method: "POST", body: JSON.stringify({ ...form, classroomId }) }); setShowForm(false); await refresh(); };
  const tutorEnrollment = selected?.enrollments.find((item) => item.classroom.isTutorGroup);
  const teachingContexts = selected?.enrollments.flatMap((enrollment) => enrollment.classroom.teachingAssignments.map((assignment) => ({
    assignment,
    classroom: enrollment.classroom,
    record: selected.subjectRecords.find((record) => record.teachingAssignmentId === assignment.id),
  }))) ?? [];
  return <div className="students-page"><div className="toolbar"><p>Una ficha personal enlazada con sus contextos académicos y tutoriales.</p><div className="toolbar-actions"><button className="secondary-action" onClick={() => { setShowBulk(!showBulk); setShowForm(false); }}>+ Varios alumnos</button><button onClick={() => { setShowForm(!showForm); setShowBulk(false); }}>+ Nuevo alumno</button></div></div>{showForm && <form className="inline-form student-form" onSubmit={(event) => void create(event)}><input placeholder="Nombre" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })}/><input placeholder="Apellidos" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })}/><select value={form.classroomId || classrooms[0]?.id} onChange={(event) => setForm({ ...form, classroomId: event.target.value })}>{classrooms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button>Crear</button></form>}{showBulk && <BulkStudentForm classrooms={classrooms} refresh={refresh} onSaved={() => setShowBulk(false)}/>}<div className="split-view"><section className="list-panel"><input className="search" placeholder="Buscar alumno…" value={search} onChange={(event) => setSearch(event.target.value)}/>{students.map((student) => <button className={selected?.id === student.id ? "selected" : ""} key={student.id} onClick={() => select(student.id)}><span className="student-avatar">{student.firstName[0]}{student.lastName[0]}</span><div><strong>{student.firstName} {student.lastName}</strong><small>{student.enrollments.map((item) => item.classroom.name).join(" · ") || "Sin grupo"}</small></div><b>{student.enrollments.reduce((total, item) => total + item.classroom.teachingAssignments.length, 0)}</b></button>)}</section><section className="detail-panel">{selected ? <><div className="profile-head"><span className="student-avatar large">{selected.firstName[0]}{selected.lastName[0]}</span><div><p className="eyebrow">Ficha general del alumno</p><h2>{selected.firstName} {selected.lastName}</h2><small>{selected.enrollments.map((item) => item.classroom.name).join(" · ") || "Sin grupo activo"}</small></div></div>
    <div className="detail-block student-contexts"><div className="profile-section-heading"><div><p className="eyebrow">Contextos enlazados</p><h3>Dónde trabajas con este alumno</h3></div><p>La tutoría y cada asignatura mantienen seguimientos independientes.</p></div>
      <div className="student-group-links">{selected.enrollments.map((item) => <button key={item.classroom.id} onClick={() => openClassroom(item.classroom.id)}><span>▦</span><div><strong>{item.classroom.name}</strong><small>{item.classroom.isTutorGroup ? "Grupo académico · también es tu tutoría" : "Grupo académico"}</small></div><b>Ver grupo →</b></button>)}</div>
      {tutorEnrollment && <button className="tutor-context-card" onClick={() => openTutor(selected.id)}><span>◷</span><div><p className="eyebrow">Seguimiento tutorial</p><strong>Mi tutoría · {tutorEnrollment.classroom.name}</strong><small>Familia, reuniones, acuerdos y seguimiento general</small></div><b>Abrir ficha tutorial →</b></button>}
      <div className="subject-context-grid">{teachingContexts.length ? teachingContexts.map(({ assignment, classroom, record }) => { const average = weightedGradeAverage(record?.grades ?? []); return <button key={assignment.id} className="subject-context-card" style={{ "--subject-color": assignment.subject.color } as CSSProperties} onClick={() => openTeaching(assignment.id, selected.id)}><i/><div><p className="eyebrow">Seguimiento académico</p><strong>{assignment.subject.name}</strong><small>{classroom.name} · solo esta asignatura</small></div><span><strong>{average === null ? "—" : average.toFixed(1)}</strong><small>media</small></span><b>Abrir →</b></button>; }) : <p className="quiet-copy">No impartes ninguna asignatura a este alumno.</p>}</div>
    </div>
    <div className="detail-block"><div className="profile-section-heading"><div><p className="eyebrow">Memoria general</p><h3>Observaciones registradas</h3></div><p>No se mezclan con las notas de una asignatura concreta.</p></div>{selected.observations.length ? selected.observations.map((item) => <ObservationCard key={item.id} item={item} refresh={refresh}/>) : <Empty text="Aún no hay observaciones."/>}</div></> : <Empty text="Selecciona un alumno."/>}</section></div></div>;
}

function BulkStudentForm({ classroomId, classroomName, classrooms = [], refresh, onSaved }: { classroomId?: string; classroomName?: string; classrooms?: Classroom[]; refresh: () => Promise<void>; onSaved?: () => void }) {
  const [selectedClassroomId, setSelectedClassroomId] = useState(classroomId ?? classrooms[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  let students: Array<{ firstName: string; lastName: string }> = [];
  let parseError = "";
  try { students = value.trim() ? parseStudentNames(value) : []; } catch (error) { parseError = error instanceof Error ? error.message : "Revisa los nombres."; }
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const target = classroomId ?? selectedClassroomId;
    if (!target || !students.length || parseError) return;
    setSaving(true); setStatus("");
    try {
      await jsonFetch(classroomId ? `/api/classrooms/${classroomId}/students` : "/api/students", { method: "POST", body: JSON.stringify({ classroomId: target, students }) });
      setStatus(`${students.length} alumnos añadidos correctamente.`); setValue(""); await refresh(); onSaved?.();
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudieron añadir los alumnos."); }
    finally { setSaving(false); }
  };
  return <form className="bulk-student-form" onSubmit={(event) => void save(event)}><div><p className="eyebrow">Alta múltiple</p><h3>Añadir varios alumnos</h3><p>Pega un nombre completo por línea. La operación se valida y se guarda como un único lote.</p></div>{!classroomId && <label>Clase<select value={selectedClassroomId} onChange={(event) => setSelectedClassroomId(event.target.value)}>{classrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{classroomId && <span className="classroom-chip">{classroomName}</span>}<label>Alumnos<textarea value={value} onChange={(event) => { setValue(event.target.value); setStatus(""); }} placeholder={"Ana López García\nBruno Martín Ruiz\nCarla Sánchez Gil"}/></label><div className="bulk-form-footer"><small className={parseError || (status && !status.includes("correctamente")) ? "form-error" : ""}>{parseError || status || `${students.length} alumnos preparados`}</small><button disabled={saving || !students.length || Boolean(parseError)}>{saving ? "Añadiendo…" : `Añadir ${students.length || ""} alumnos`}</button></div></form>;
}

export function TutoringView({ items, selected, select, refresh, startChat }: { items: Tutoring[]; selected?: Tutoring; select: (id: string) => void; refresh: () => Promise<void>; startChat: (name: string) => void }) {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [agreement, setAgreement] = useState("");
  const notes = selected ? (notesById[selected.id] ?? selected.notes ?? "") : "";
  const save = async (status?: "completed") => { if (!selected) return; await jsonFetch(`/api/tutorings/${selected.id}`, { method: "PATCH", body: JSON.stringify({ notes, ...(status ? { status } : {}) }) }); await refresh(); };
  const addAgreement = async () => { if (!selected || !agreement.trim()) return; await jsonFetch(`/api/tutorings/${selected.id}/agreements`, { method: "POST", body: JSON.stringify({ description: agreement }) }); setAgreement(""); await refresh(); };
  return <div className="view-stack"><div className="toolbar"><p>Borradores basados en hechos registrados y propuestas claramente separadas.</p><button onClick={() => startChat("Lucas")}>+ Preparar tutoría</button></div>{items.length ? <div className="split-view embedded"><section className="list-panel">{items.map((item) => <button className={selected?.id === item.id ? "selected" : ""} key={item.id} onClick={() => select(item.id)}><span className="student-avatar">{item.student.firstName[0]}{item.student.lastName[0]}</span><div><strong>{item.student.firstName} {item.student.lastName}</strong><small>{new Date(item.createdAt).toLocaleDateString("es-ES")} · {item.status}</small></div></button>)}</section><section className="detail-panel tutoring-detail"><pre>{selected?.preparation}</pre><label>Notas de la reunión<textarea value={notes} onChange={(event) => selected && setNotesById((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder="Añade notas…"/></label><div><button onClick={() => void save()}>Guardar notas</button><button className="secondary" onClick={() => void save("completed")}>Marcar realizada</button></div><div className="agreements"><h3>Acuerdos</h3>{selected?.agreements.map((item) => <p key={item.id}>✓ {item.description}</p>)}<div><input value={agreement} onChange={(event) => setAgreement(event.target.value)} placeholder="Nuevo acuerdo…"/><button onClick={() => void addAgreement()}>Añadir</button></div></div></section></div> : <EmptyAction text="Todavía no hay tutorías preparadas." action="Preparar la de Lucas" onClick={() => startChat("Lucas")}/>}</div>;
}

function SeatingView({ layout, selected, setSelected, refresh, generate }: { layout: Layout | null; selected: string[]; setSelected: (ids: string[]) => void; refresh: () => Promise<void>; generate: () => void }) {
  const click = async (id: string) => { const next = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id].slice(-2); setSelected(next); if (next.length === 2 && layout) { await jsonFetch(`/api/layouts/${layout.id}/swap`, { method: "POST", body: JSON.stringify({ firstId: next[0], secondId: next[1] }) }); setSelected([]); await refresh(); } };
  if (!layout) return <EmptyAction text="Aún no hay una distribución guardada." action="Generar propuesta 5×5" onClick={generate}/>;
  return <div className="seating-page"><div className="toolbar"><div><p>{layout.classroom.name}</p><small>{layout.name}</small></div><button onClick={generate}>Generar otra propuesta</button></div><div className="board">PIZARRA</div><div className="seat-grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(100px, 1fr))` }}>{layout.assignments.map((assignment) => <button className={selected.includes(assignment.id) ? "selected" : ""} key={assignment.id} onClick={() => void click(assignment.id)}><span>{assignment.row + 1}.{assignment.column + 1}</span><strong>{assignment.student.firstName}</strong><small>{assignment.student.lastName}</small></button>)}</div><div className="teacher-desk">Mesa de la profesora</div><p className="seat-help">Selecciona dos pupitres para intercambiar a los alumnos. El cambio se guarda inmediatamente.</p></div>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>○</span><p>{text}</p></div>; }
function EmptyAction({ text, action, onClick }: { text: string; action: string; onClick: () => void }) { return <div className="empty-action"><AlfredAvatar className="orb small empty-avatar" size={56}/><h2>{text}</h2><button onClick={onClick}>{action}</button></div>; }

function ObservationCard({ item, refresh }: { item: Observation; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const save = async () => { await jsonFetch(`/api/observations/${item.id}`, { method: "PATCH", body: JSON.stringify({ content }) }); setEditing(false); await refresh(); };
  const remove = async () => { if (!window.confirm("¿Eliminar esta observación? Esta acción no se puede deshacer.")) return; await jsonFetch(`/api/observations/${item.id}`, { method: "DELETE" }); await refresh(); };
  return <article className="observation"><span>{item.category.replaceAll("_", " ")}</span>{editing ? <div className="observation-edit"><input value={content} onChange={(event) => setContent(event.target.value)}/><button onClick={() => void save()}>Guardar</button></div> : <p>{item.content}</p>}<small>{new Date(item.observedAt).toLocaleDateString("es-ES")}</small><div className="observation-actions"><button onClick={() => setEditing(!editing)}>Editar</button><button onClick={() => void remove()}>Eliminar</button></div></article>;
}
