"use client";

import { useEffect, useMemo, useState } from "react";

interface AgentCapability { id: string; description: string; mutatesData: boolean }
interface AgentExecution { id: string; operation: string; status: string; startedAt: string; finishedAt: string | null; error: string | null }
interface AgentInfo {
  id: string; name: string; description: string; capabilities: AgentCapability[];
  runtime: { status: "running" | "stopped"; startedAt: string | null; stoppedAt: string | null; restartedAt: string | null; restartCount: number };
  statistics: { totalExecutions: number; executionsToday: number; completed: number; failed: number; successRate: number; averageDurationMs: number; lastExecutionAt: string | null; operations: Array<{ operation: string; count: number }> };
  recentExecutions: AgentExecution[];
}
interface DatabaseTable { key: string; label: string; group: string; count: number }
interface DatabaseScope { key: string; label: string; confirmation: string; total: boolean }
interface DatabaseOverview {
  engine: string;
  totalRecords: number;
  tables: DatabaseTable[];
  deletionScopes: DatabaseScope[];
  selected: { key: string; label: string; group: string; count: number; columns: string[]; rows: Array<Record<string, string | number | boolean | null>> };
}
interface A2AMessage { id: string; protocol: string; messageId: string; fromAgentId: string; toAgentId: string; kind: "request" | "response" | "error"; capability: string; content: string; payload: unknown; createdAt: string }
interface A2AConversation { id: string; requestId: string; title: string; status: string; createdAt: string; finishedAt: string | null; messages: A2AMessage[] }
interface A2AHistory { protocol: string; totalConversations: number; totalMessages: number; conversations: A2AConversation[] }

async function getAgents(): Promise<AgentInfo[]> {
  const response = await fetch("/api/admin/agents", { cache: "no-store" });
  const body = await response.json() as AgentInfo[] & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar los agentes.");
  return body;
}

export function AdminView({ onContextChange, onDataChanged }: { onContextChange?: (summary: string) => void; onDataChanged?: () => Promise<void> }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedId, setSelectedId] = useState("alfred-orchestrator");
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState("");
  const [section, setSection] = useState<"agents" | "a2a" | "database">("agents");
  useEffect(() => { void getAgents().then(setAgents).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "No se pudieron cargar los agentes.")); }, []);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const totals = useMemo(() => ({
    running: agents.filter((agent) => agent.runtime.status === "running").length,
    stopped: agents.filter((agent) => agent.runtime.status === "stopped").length,
    today: agents.reduce((sum, agent) => sum + agent.statistics.executionsToday, 0),
  }), [agents]);
  useEffect(() => {
    onContextChange?.(section === "database"
      ? "Administrador local de la base de datos: tablas, registros y herramientas de borrado seguro."
      : section === "a2a"
      ? "Trazabilidad de conversaciones A2A entre Alfred y los agentes especializados, con solicitudes y respuestas estructuradas."
      : selected
      ? `Detalle visible del agente ${selected.name}: estado ${selected.runtime.status === "running" ? "activo" : "detenido"}, ${selected.statistics.totalExecutions} ejecuciones, ${selected.statistics.successRate}% de éxito y ${selected.statistics.failed} errores.`
      : "Panel de administración y estado de los siete agentes locales.");
  }, [onContextChange, section, selected]);

  const control = async (agentId: string, action: "start" | "stop" | "restart") => {
    setBusyId(agentId); setError("");
    try {
      const response = await fetch(`/api/admin/agents/${agentId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json() as { agents?: AgentInfo[]; error?: string };
      if (!response.ok || !body.agents) throw new Error(body.error ?? "No se pudo controlar el agente.");
      setAgents(body.agents);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo controlar el agente."); }
    finally { setBusyId(undefined); }
  };

  return <div className="admin-page">
    <div className="admin-tabs" role="tablist" aria-label="Administración"><button role="tab" aria-selected={section === "agents"} className={section === "agents" ? "active" : ""} onClick={() => setSection("agents")}>Agentes</button><button role="tab" aria-selected={section === "a2a"} className={section === "a2a" ? "active" : ""} onClick={() => setSection("a2a")}>Conversaciones A2A</button><button role="tab" aria-selected={section === "database"} className={section === "database" ? "active" : ""} onClick={() => setSection("database")}>Base de datos</button></div>
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    {section === "database" ? <DatabaseAdmin onDataChanged={async () => { await getAgents().then(setAgents); await onDataChanged?.(); }} /> : section === "a2a" ? <A2AAdmin/> : <>
    <section className="admin-summary">
      <article><span className="status-dot is-ready"/><div><strong>{totals.running}</strong><small>Agentes activos</small></div></article>
      <article><span className="status-dot is-stopped"/><div><strong>{totals.stopped}</strong><small>Agentes detenidos</small></div></article>
      <article><span>↗</span><div><strong>{totals.today}</strong><small>Ejecuciones hoy</small></div></article>
      <article><span>◉</span><div><strong>{agents.reduce((sum, item) => sum + item.statistics.totalExecutions, 0)}</strong><small>Ejecuciones totales</small></div></article>
    </section>
    <div className="admin-layout">
      <section className="agent-list"><div className="agent-list-head"><p className="eyebrow">Sistema multiagente</p><h2>Agentes</h2><small>Módulos locales de Alfred</small></div>{agents.map((agent) => <button className={selected?.id === agent.id ? "selected" : ""} key={agent.id} onClick={() => setSelectedId(agent.id)}><span className={`agent-state ${agent.runtime.status}`}/><div><strong>{agent.name}</strong><small>{agent.capabilities.length} capacidades · {agent.statistics.totalExecutions} usos</small></div><b>›</b></button>)}</section>
      <section className="agent-detail">{selected ? <>
        <header><div><p className="eyebrow">Detalle del agente</p><h2>{selected.name}</h2><p>{selected.description}</p></div><span className={`runtime-badge ${selected.runtime.status}`}>{selected.runtime.status === "running" ? "● Activo" : "■ Detenido"}</span></header>
        <div className="agent-controls"><button disabled={busyId === selected.id || selected.runtime.status === "running"} onClick={() => void control(selected.id, "start")}>▶ Iniciar</button><button disabled={busyId === selected.id || selected.runtime.status === "stopped"} onClick={() => void control(selected.id, "stop")}>■ Detener</button><button disabled={busyId === selected.id} onClick={() => void control(selected.id, "restart")}>↻ Reiniciar</button><small>{busyId === selected.id ? "Aplicando…" : `Reinicios: ${selected.runtime.restartCount}`}</small></div>
        <div className="agent-metrics"><article><strong>{selected.statistics.totalExecutions}</strong><small>Ejecuciones</small></article><article><strong>{selected.statistics.successRate}%</strong><small>Éxito</small></article><article><strong>{selected.statistics.averageDurationMs} ms</strong><small>Duración media</small></article><article><strong>{selected.statistics.failed}</strong><small>Errores</small></article></div>
        <div className="agent-section"><h3>Capacidades</h3>{selected.capabilities.map((item) => <article className="capability-row" key={item.id}><span>{item.mutatesData ? "Escritura" : "Lectura"}</span><div><strong>{item.id}</strong><p>{item.description}</p></div></article>)}</div>
        <div className="agent-section"><h3>Actividad reciente</h3>{selected.recentExecutions.length ? selected.recentExecutions.map((item) => <article className="execution-row" key={item.id}><span className={`status-dot ${item.status === "completed" ? "is-ready" : "is-stopped"}`}/><div><strong>{item.operation}</strong><small>{new Date(item.startedAt).toLocaleString("es-ES")}</small>{item.error && <p>{item.error}</p>}</div><time>{item.finishedAt ? `${new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()} ms` : "En curso"}</time></article>) : <p className="muted-copy">Este agente todavía no tiene ejecuciones.</p>}</div>
      </> : <div className="detail-placeholder">Cargando agentes…</div>}</section>
    </div>
    </>}
  </div>;
}

function agentLabel(agentId: string) {
  const labels: Record<string, string> = {
    "alfred-orchestrator": "Alfred",
    "student-agent": "StudentAgent",
    "memory-agent": "MemoryAgent",
    "tutoring-agent": "TutoringAgent",
    "classroom-agent": "ClassroomAgent",
    "planning-agent": "PlanningAgent",
    "curriculum-agent": "CurriculumAgent",
  };
  return labels[agentId] ?? agentId;
}

function A2AAdmin() {
  const [data, setData] = useState<A2AHistory>();
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/a2a", { cache: "no-store" });
      const body = await response.json() as A2AHistory & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la actividad A2A.");
      setData(body); setSelectedId((current) => current ?? body.conversations[0]?.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar la actividad A2A."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/a2a", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as A2AHistory & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la actividad A2A.");
        return body;
      })
      .then((body) => {
        if (!active) return;
        setData(body);
        setSelectedId(body.conversations[0]?.id);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "No se pudo cargar la actividad A2A.");
      });
    return () => { active = false; };
  }, []);
  const selected = data?.conversations.find((item) => item.id === selectedId) ?? data?.conversations[0];
  if (!data) return <div className="database-loading">{error || "Cargando conversaciones A2A…"}</div>;
  return <div className="a2a-admin">
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    <section className="admin-summary"><article><span>⇄</span><div><strong>{data.totalConversations}</strong><small>Conversaciones A2A</small></div></article><article><span>✦</span><div><strong>{data.totalMessages}</strong><small>Mensajes entre agentes</small></div></article><article><span>◎</span><div><strong>{data.protocol}</strong><small>Protocolo interno</small></div></article><article><span className="status-dot is-ready"/><div><strong>Local</strong><small>Sin servicios externos</small></div></article></section>
    <section className="a2a-layout"><aside className="a2a-thread-list"><header><div><p className="eyebrow">Trazabilidad</p><h2>Intercambios</h2></div><button disabled={busy} onClick={() => void load()}>↻</button></header>{data.conversations.length ? data.conversations.map((conversation) => <button className={selected?.id === conversation.id ? "selected" : ""} key={conversation.id} onClick={() => setSelectedId(conversation.id)}><span className={`agent-state ${conversation.status === "completed" ? "running" : "stopped"}`}/><div><strong>{conversation.messages[0]?.capability.replaceAll("_", " ") ?? conversation.title}</strong><small>{conversation.messages[0] ? `${agentLabel(conversation.messages[0].fromAgentId)} → ${agentLabel(conversation.messages[0].toAgentId)}` : conversation.title}</small><time>{new Date(conversation.createdAt).toLocaleString("es-ES")}</time></div></button>) : <p className="muted-copy">Habla con Alfred para generar el primer intercambio A2A.</p>}</aside><div className="a2a-thread-detail">{selected ? <><header><div><p className="eyebrow">Conversación A2A</p><h2>{selected.messages[0]?.capability.replaceAll("_", " ") ?? selected.title}</h2><small>{selected.requestId} · {new Date(selected.createdAt).toLocaleString("es-ES")}</small></div><span className={`runtime-badge ${selected.status === "completed" ? "running" : "stopped"}`}>{selected.status === "completed" ? "● Completada" : "■ Con error"}</span></header><div className="a2a-timeline">{selected.messages.map((message) => <article className={`a2a-message ${message.kind}`} key={message.id}><div className="a2a-route"><strong>{agentLabel(message.fromAgentId)}</strong><span>→</span><strong>{agentLabel(message.toAgentId)}</strong><time>{new Date(message.createdAt).toLocaleTimeString("es-ES")}</time></div><p>{message.content}</p><details><summary>Datos estructurados</summary><pre>{JSON.stringify(message.payload, null, 2)}</pre></details></article>)}</div></> : <div className="detail-placeholder">Selecciona un intercambio.</div>}</div></section>
    <p className="a2a-privacy-note">Solo se guardan solicitudes estructuradas y respuestas finales. No se registra el razonamiento interno del modelo.</p>
  </div>;
}

type DeleteRequest =
  | { kind: "scope"; scope: DatabaseScope }
  | { kind: "record"; table: string; id: string; label: string; confirmation: string };

async function getDatabase(table: string): Promise<DatabaseOverview> {
  const response = await fetch(`/api/admin/database?table=${encodeURIComponent(table)}`, { cache: "no-store" });
  const body = await response.json() as DatabaseOverview & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo consultar la base de datos.");
  return body;
}

function DatabaseAdmin({ onDataChanged }: { onDataChanged: () => Promise<void> }) {
  const [data, setData] = useState<DatabaseOverview>();
  const [selectedTable, setSelectedTable] = useState("students");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest>();
  const [confirmation, setConfirmation] = useState("");
  const load = async (table: string) => {
    setBusy(true); setError("");
    try { setData(await getDatabase(table)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo consultar la base de datos."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    void getDatabase(selectedTable).then((result) => { if (active) setData(result); }).catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "No se pudo consultar la base de datos."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [selectedTable]);

  const expectedConfirmation = deleteRequest?.kind === "scope" ? deleteRequest.scope.confirmation : deleteRequest?.confirmation;
  const executeDelete = async () => {
    if (!deleteRequest || confirmation !== expectedConfirmation) return;
    setBusy(true); setError("");
    try {
      if (deleteRequest.kind === "scope") {
        const response = await fetch("/api/admin/database/clear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: deleteRequest.scope.key, confirmation }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo borrar la información.");
      } else {
        const response = await fetch(`/api/admin/database/${encodeURIComponent(deleteRequest.table)}/${encodeURIComponent(deleteRequest.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo borrar el registro.");
      }
      setDeleteRequest(undefined); setConfirmation("");
      await onDataChanged();
      setData(await getDatabase(selectedTable));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo borrar la información."); }
    finally { setBusy(false); }
  };
  const recordId = (row: Record<string, string | number | boolean | null>) => String(row.id ?? row.agentId ?? "");

  if (!data) return <div className="database-loading">{error || "Cargando la base de datos local…"}</div>;
  return <div className="database-admin">
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    <section className="database-summary"><article><span>▤</span><div><strong>{data.tables.length}</strong><small>Tablas administradas</small></div></article><article><span>◎</span><div><strong>{data.totalRecords}</strong><small>Registros totales</small></div></article><article><span>⌁</span><div><strong>Local</strong><small>{data.engine}</small></div></article></section>
    <section className="database-browser">
      <aside className="database-table-list"><div><p className="eyebrow">Explorador</p><h2>Tablas</h2></div>{data.tables.map((table) => <button className={selectedTable === table.key ? "selected" : ""} key={table.key} onClick={() => { setBusy(true); setSelectedTable(table.key); }}><span><strong>{table.label}</strong><small>{table.group}</small></span><b>{table.count}</b></button>)}</aside>
      <div className="database-records"><header><div><p className="eyebrow">{data.selected.group}</p><h2>{data.selected.label}</h2><small>Mostrando hasta 50 registros · {data.selected.count} en total</small></div><button onClick={() => void load(selectedTable)} disabled={busy}>↻ Actualizar</button></header>
        <div className="database-table-scroll">{data.selected.rows.length ? <table><thead><tr><th>Acciones</th>{data.selected.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{data.selected.rows.map((row) => { const id = recordId(row); return <tr key={id}><td><button className="record-delete" disabled={!id || busy} onClick={() => { setDeleteRequest({ kind: "record", table: data.selected.key, id, label: `${data.selected.label}: ${id}`, confirmation: `BORRAR ${id}` }); setConfirmation(""); }}>Borrar</button></td>{data.selected.columns.map((column) => <td title={String(row[column] ?? "")} key={column}>{formatCell(row[column])}</td>)}</tr>; })}</tbody></table> : <div className="database-empty">Esta tabla no contiene registros.</div>}</div>
      </div>
    </section>
    <section className="data-deletion"><div className="section-heading"><div><p className="eyebrow">Gestión de datos</p><h3>Borrado por áreas</h3></div><span>Las operaciones son irreversibles</span></div><div className="deletion-grid">{data.deletionScopes.map((scope) => <article className={scope.total ? "total" : ""} key={scope.key}><div><strong>{scope.label}</strong><small>{scope.total ? "Elimina todos los datos de la aplicación, no el esquema." : "Elimina esta área y sus registros dependientes."}</small></div><button disabled={busy} onClick={() => { setDeleteRequest({ kind: "scope", scope }); setConfirmation(""); }}>{scope.total ? "Borrar todo" : "Borrar área"}</button></article>)}</div></section>
    {deleteRequest && <div className="delete-dialog-backdrop" role="presentation"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span>!</span><p className="eyebrow">Confirmación obligatoria</p><h2 id="delete-title">{deleteRequest.kind === "scope" ? deleteRequest.scope.label : deleteRequest.label}</h2><p>Esta operación no se puede deshacer. Escribe exactamente <strong>{expectedConfirmation}</strong> para continuar.</p><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={expectedConfirmation}/><div><button onClick={() => { setDeleteRequest(undefined); setConfirmation(""); }}>Cancelar</button><button className="danger" disabled={busy || confirmation !== expectedConfirmation} onClick={() => void executeDelete()}>{busy ? "Borrando…" : "Borrar definitivamente"}</button></div></section></div>}
  </div>;
}

function formatCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return <span className="null-value">—</span>;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}
