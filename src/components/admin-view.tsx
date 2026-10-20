"use client";

import { useEffect, useMemo, useState } from "react";

interface AgentCapability { id: string; description: string; mutatesData: boolean }
interface AgentExecution { id: string; operation: string; status: string; startedAt: string; finishedAt: string | null; error: string | null }
interface AgentInfo {
  id: string; name: string; description: string; capabilities: AgentCapability[];
  ai: { usesAi: boolean; configuredModel: string | null };
  runtime: { status: "running" | "stopped"; startedAt: string | null; stoppedAt: string | null; restartedAt: string | null; restartCount: number };
  statistics: { totalExecutions: number; executionsToday: number; completed: number; failed: number; successRate: number; averageDurationMs: number; lastExecutionAt: string | null; operations: Array<{ operation: string; count: number }> };
  recentExecutions: AgentExecution[];
}
interface AiModelCatalog { connected: boolean; defaultModel: string | null; models: Array<{ id: string; label: string }> }
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
interface CloudAiLog {
  id: string; conversationId: string | null; agentId: string | null; provider: string; endpoint: string; operation: string; model: string;
  status: "running" | "completed" | "failed"; requestBody: unknown; responseBody: unknown; responseId: string | null;
  requestId: string | null; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null;
  durationMs: number | null; studentAliasCount: number; errorCode: string | null; errorMessage: string | null;
  createdAt: string; finishedAt: string | null;
}
interface CloudAiLogDashboard {
  summary: { total: number; completed: number; failed: number; running: number; successRate: number; averageDurationMs: number; totalTokens: number };
  filters: { models: Array<{ value: string; count: number }>; operations: Array<{ value: string; count: number }> };
  histogram: Array<{ at: string; count: number }>;
  logs: CloudAiLog[];
}

async function getAgents(): Promise<AgentInfo[]> {
  const response = await fetch("/api/admin/agents", { cache: "no-store" });
  const body = await response.json() as AgentInfo[] & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar los agentes.");
  return body;
}

async function getAiModels(): Promise<AiModelCatalog> {
  const response = await fetch("/api/admin/ai-models", { cache: "no-store" });
  const body = await response.json() as AiModelCatalog & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el catálogo de modelos.");
  return body;
}

export function AdminView({ onContextChange, onDataChanged }: { onContextChange?: (summary: string) => void; onDataChanged?: () => Promise<void> }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedId, setSelectedId] = useState("alfred-orchestrator");
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState("");
  const [modelCatalog, setModelCatalog] = useState<AiModelCatalog>({ connected: false, defaultModel: null, models: [] });
  const [section, setSection] = useState<"agents" | "a2a" | "logs" | "database">("agents");
  useEffect(() => { void getAgents().then(setAgents).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "No se pudieron cargar los agentes.")); }, []);
  useEffect(() => { void getAiModels().then(setModelCatalog).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "No se pudo cargar el catálogo de modelos.")); }, []);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const totals = useMemo(() => ({
    running: agents.filter((agent) => agent.runtime.status === "running").length,
    stopped: agents.filter((agent) => agent.runtime.status === "stopped").length,
    today: agents.reduce((sum, agent) => sum + agent.statistics.executionsToday, 0),
  }), [agents]);
  useEffect(() => {
    onContextChange?.(section === "database"
      ? "Administrador local de la base de datos: tablas, registros y herramientas de borrado seguro."
      : section === "logs"
      ? "Logs auditables de las peticiones seudonimizadas enviadas a ChatGPT y sus respuestas observables."
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

  const configureModel = async (agentId: string, model: string) => {
    setBusyId(agentId); setError("");
    try {
      const response = await fetch(`/api/admin/agents/${agentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: model || null }) });
      const body = await response.json() as { agents?: AgentInfo[]; error?: string };
      if (!response.ok || !body.agents) throw new Error(body.error ?? "No se pudo configurar el modelo.");
      setAgents(body.agents);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo configurar el modelo."); }
    finally { setBusyId(undefined); }
  };

  return <div className="admin-page">
    <div className="admin-tabs" role="tablist" aria-label="Administración"><button role="tab" aria-selected={section === "agents"} className={section === "agents" ? "active" : ""} onClick={() => setSection("agents")}>Agentes</button><button role="tab" aria-selected={section === "a2a"} className={section === "a2a" ? "active" : ""} onClick={() => setSection("a2a")}>Conversaciones A2A</button><button role="tab" aria-selected={section === "logs"} className={section === "logs" ? "active" : ""} onClick={() => setSection("logs")}>Logs</button><button role="tab" aria-selected={section === "database"} className={section === "database" ? "active" : ""} onClick={() => setSection("database")}>Base de datos</button></div>
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    {section === "database" ? <DatabaseAdmin onDataChanged={async () => { await getAgents().then(setAgents); await onDataChanged?.(); }} /> : section === "logs" ? <LogsAdmin/> : section === "a2a" ? <A2AAdmin/> : <>
    <section className="admin-summary">
      <article><span className="status-dot is-ready"/><div><strong>{totals.running}</strong><small>Agentes activos</small></div></article>
      <article><span className="status-dot is-stopped"/><div><strong>{totals.stopped}</strong><small>Agentes detenidos</small></div></article>
      <article><span>↗</span><div><strong>{totals.today}</strong><small>Ejecuciones hoy</small></div></article>
      <article><span>◉</span><div><strong>{agents.reduce((sum, item) => sum + item.statistics.totalExecutions, 0)}</strong><small>Ejecuciones totales</small></div></article>
    </section>
    <div className="admin-layout">
      <section className="agent-list"><div className="agent-list-head"><p className="eyebrow">Sistema multiagente</p><h2>Agentes</h2><small>Módulos locales de Alfred</small></div>{agents.map((agent) => <button className={selected?.id === agent.id ? "selected" : ""} key={agent.id} onClick={() => setSelectedId(agent.id)}><span className={`agent-state ${agent.runtime.status}`}/><div><strong>{agent.name}</strong><small>{agent.capabilities.length} capacidades · {agent.statistics.totalExecutions} usos{agent.ai.usesAi ? " · IA" : ""}</small></div><b>›</b></button>)}</section>
      <section className="agent-detail">{selected ? <>
        <header><div><p className="eyebrow">Detalle del agente</p><h2>{selected.name}</h2><p>{selected.description}</p></div><span className={`runtime-badge ${selected.runtime.status}`}>{selected.runtime.status === "running" ? "● Activo" : "■ Detenido"}</span></header>
        <div className="agent-controls"><button disabled={busyId === selected.id || selected.runtime.status === "running"} onClick={() => void control(selected.id, "start")}>▶ Iniciar</button><button disabled={busyId === selected.id || selected.runtime.status === "stopped"} onClick={() => void control(selected.id, "stop")}>■ Detener</button><button disabled={busyId === selected.id} onClick={() => void control(selected.id, "restart")}>↻ Reiniciar</button><small>{busyId === selected.id ? "Aplicando…" : `Reinicios: ${selected.runtime.restartCount}`}</small></div>
        {selected.ai.usesAi && <div className="agent-model-config"><div><span>✦</span><div><strong>Modelo de inteligencia artificial</strong><small>{modelCatalog.connected ? "Elige el modelo para las tareas generativas de este agente." : "Conecta ChatGPT para consultar y seleccionar los modelos disponibles."}</small></div></div><label>Modelo<select aria-label={`Modelo de IA de ${selected.name}`} disabled={!modelCatalog.connected || busyId === selected.id} value={selected.ai.configuredModel ?? ""} onChange={(event) => void configureModel(selected.id, event.target.value)}><option value="">Automático{modelCatalog.defaultModel ? ` · ${modelCatalog.defaultModel}` : ""}</option>{selected.ai.configuredModel && !modelCatalog.models.some((model) => model.id === selected.ai.configuredModel) && <option value={selected.ai.configuredModel}>{selected.ai.configuredModel} · no disponible ahora</option>}{modelCatalog.models.map((model) => <option key={model.id} value={model.id}>{model.label}{model.label !== model.id ? ` · ${model.id}` : ""}</option>)}</select></label><p>Modelo efectivo: <strong>{selected.ai.configuredModel ?? modelCatalog.defaultModel ?? "modo manual"}</strong>. Las peticiones aparecerán con este valor en Logs.</p></div>}
        <div className="agent-metrics"><article><strong>{selected.statistics.totalExecutions}</strong><small>Ejecuciones</small></article><article><strong>{selected.statistics.successRate}%</strong><small>Éxito</small></article><article><strong>{selected.statistics.averageDurationMs} ms</strong><small>Duración media</small></article><article><strong>{selected.statistics.failed}</strong><small>Errores</small></article></div>
        <div className="agent-section"><h3>Capacidades</h3>{selected.capabilities.map((item) => <article className="capability-row" key={item.id}><span>{item.mutatesData ? "Escritura" : "Lectura"}</span><div><strong>{item.id}</strong><p>{item.description}</p></div></article>)}</div>
        <div className="agent-section"><h3>Actividad reciente</h3>{selected.recentExecutions.length ? selected.recentExecutions.map((item) => <article className="execution-row" key={item.id}><span className={`status-dot ${item.status === "completed" ? "is-ready" : "is-stopped"}`}/><div><strong>{item.operation}</strong><small>{new Date(item.startedAt).toLocaleString("es-ES")}</small>{item.error && <p>{item.error}</p>}</div><time>{item.finishedAt ? `${new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()} ms` : "En curso"}</time></article>) : <p className="muted-copy">Este agente todavía no tiene ejecuciones.</p>}</div>
      </> : <div className="detail-placeholder">Cargando agentes…</div>}</section>
    </div>
    </>}
  </div>;
}

function statusLabel(status: CloudAiLog["status"]) {
  if (status === "completed") return "Completada";
  if (status === "failed") return "Error";
  return "En curso";
}

function prettyJson(value: unknown) {
  return value === null ? "Sin contenido" : JSON.stringify(value, null, 2);
}

async function getCloudAiLogs(filters: { query: string; status: string; model: string; operation: string; range: string }) {
  const parameters = new URLSearchParams({ ...filters, limit: "100" });
  const response = await fetch(`/api/admin/logs?${parameters}`, { cache: "no-store" });
  const body = await response.json() as CloudAiLogDashboard & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar los logs de ChatGPT.");
  return body;
}

function LogsAdmin() {
  const [data, setData] = useState<CloudAiLogDashboard>();
  const [selectedId, setSelectedId] = useState<string>();
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [model, setModel] = useState("all");
  const [operation, setOperation] = useState("all");
  const [range, setRange] = useState("7d");
  const [detailTab, setDetailTab] = useState<"request" | "response" | "metadata">("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try {
      const body = await getCloudAiLogs({ query, status, model, operation, range });
      setData(body);
      setSelectedId((current) => body.logs.some((item) => item.id === current) ? current : body.logs[0]?.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron cargar los logs de ChatGPT."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    let active = true;
    void getCloudAiLogs({ query, status, model, operation, range })
      .then((body) => {
        if (!active) return;
        setData(body);
        setSelectedId((current) => body.logs.some((item) => item.id === current) ? current : body.logs[0]?.id);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "No se pudieron cargar los logs de ChatGPT.");
      });
    return () => { active = false; };
  }, [query, status, model, operation, range]);
  const selected = data?.logs.find((item) => item.id === selectedId) ?? data?.logs[0];
  const maxBucket = Math.max(1, ...(data?.histogram.map((item) => item.count) ?? [1]));
  const clear = async () => {
    if (confirmation !== "BORRAR LOGS") return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/logs", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron borrar los logs.");
      setShowDelete(false); setConfirmation(""); setSelectedId(undefined);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron borrar los logs."); setBusy(false); }
  };

  if (!data) return <div className="database-loading">{error || "Cargando logs de ChatGPT…"}</div>;
  return <div className="logs-admin">
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    <section className="logs-toolbar">
      <form onSubmit={(event) => { event.preventDefault(); setQuery(queryInput); }}><span>⌕</span><input aria-label="Buscar en logs" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar en petición, respuesta, operación o ID…"/><button type="submit">Buscar</button></form>
      <button className="logs-refresh" disabled={busy} onClick={() => void load()}>↻ Actualizar</button>
      <button className="logs-delete" disabled={busy || data.summary.total === 0} onClick={() => setShowDelete(true)}>Borrar logs</button>
    </section>
    <section className="logs-filters" aria-label="Filtros de logs">
      <label>Periodo<select value={range} onChange={(event) => setRange(event.target.value)}><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="all">Todo el histórico</option></select></label>
      <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos</option><option value="completed">Completadas</option><option value="failed">Con error</option><option value="running">En curso</option></select></label>
      <label>Modelo<select value={model} onChange={(event) => setModel(event.target.value)}><option value="all">Todos</option>{data.filters.models.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select></label>
      <label>Operación<select value={operation} onChange={(event) => setOperation(event.target.value)}><option value="all">Todas</option>{data.filters.operations.map((item) => <option key={item.value} value={item.value}>{item.value.replaceAll("_", " ")} ({item.count})</option>)}</select></label>
    </section>
    <section className="logs-summary admin-summary">
      <article><span>◎</span><div><strong>{data.summary.total}</strong><small>Peticiones en el periodo</small></div></article>
      <article><span className="status-dot is-ready"/><div><strong>{data.summary.successRate}%</strong><small>Tasa de éxito</small></div></article>
      <article><span>◷</span><div><strong>{data.summary.averageDurationMs} ms</strong><small>Duración media</small></div></article>
      <article><span>∑</span><div><strong>{data.summary.totalTokens.toLocaleString("es-ES")}</strong><small>Tokens registrados</small></div></article>
    </section>
    <section className="logs-histogram" aria-label="Peticiones a ChatGPT en el tiempo"><header><div><p className="eyebrow">Actividad</p><h2>Peticiones a ChatGPT</h2></div><small>{data.summary.completed} completadas · {data.summary.failed} errores · {data.summary.running} en curso</small></header><div className="histogram-bars">{data.histogram.length ? data.histogram.map((bucket) => <div key={bucket.at} title={`${new Date(bucket.at).toLocaleString("es-ES")}: ${bucket.count}`}><span style={{ height: `${Math.max(8, (bucket.count / maxBucket) * 100)}%` }}/><small>{new Date(bucket.at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}</small></div>) : <p>No hay actividad en este periodo.</p>}</div></section>
    <section className="logs-layout">
      <div className="logs-list"><header><div><p className="eyebrow">Resultados</p><h2>{data.logs.length} eventos</h2></div>{busy && <small>Actualizando…</small>}</header>{data.logs.length ? data.logs.map((log) => <button key={log.id} className={selected?.id === log.id ? "selected" : ""} onClick={() => { setSelectedId(log.id); setDetailTab("request"); }}><span className={`log-status ${log.status}`}/><div><strong>{log.operation.replaceAll("_", " ")}</strong><small>{log.agentId ? `${agentLabel(log.agentId)} · ` : ""}{log.model} · {log.durationMs === null ? "en curso" : `${log.durationMs} ms`}</small><time>{new Date(log.createdAt).toLocaleString("es-ES")}</time></div><b>{log.totalTokens ?? "—"}</b></button>) : <div className="logs-empty"><strong>No hay logs para estos filtros</strong><p>Las nuevas llamadas a ChatGPT aparecerán aquí automáticamente.</p></div>}</div>
      <div className="logs-detail">{selected ? <><header><div><p className="eyebrow">Detalle de la petición</p><h2>{selected.operation.replaceAll("_", " ")}</h2><small>{selected.id}</small></div><span className={`log-status-badge ${selected.status}`}>{statusLabel(selected.status)}</span></header><div className="logs-detail-tabs" role="tablist" aria-label="Contenido del log"><button role="tab" aria-selected={detailTab === "request"} className={detailTab === "request" ? "active" : ""} onClick={() => setDetailTab("request")}>Petición enviada</button><button role="tab" aria-selected={detailTab === "response"} className={detailTab === "response" ? "active" : ""} onClick={() => setDetailTab("response")}>Respuesta observable</button><button role="tab" aria-selected={detailTab === "metadata"} className={detailTab === "metadata" ? "active" : ""} onClick={() => setDetailTab("metadata")}>Metadatos</button></div>{detailTab === "request" ? <div className="log-json"><div><span>Contenido exacto enviado · nombres de alumnos protegidos con alias</span><button onClick={() => void navigator.clipboard.writeText(prettyJson(selected.requestBody))}>Copiar JSON</button></div><pre>{prettyJson(selected.requestBody)}</pre></div> : detailTab === "response" ? <div className="log-json"><div><span>Salida recibida antes de sustituir alias localmente</span><button onClick={() => void navigator.clipboard.writeText(prettyJson(selected.responseBody))}>Copiar JSON</button></div><pre>{prettyJson(selected.responseBody)}</pre>{selected.errorMessage && <p className="log-error">{selected.errorCode}: {selected.errorMessage}</p>}</div> : <dl className="log-metadata"><div><dt>Agente</dt><dd>{selected.agentId ? agentLabel(selected.agentId) : "Sin agente asociado"}</dd></div><div><dt>Proveedor</dt><dd>{selected.provider}</dd></div><div><dt>Modelo</dt><dd>{selected.model}</dd></div><div><dt>Endpoint</dt><dd>{selected.endpoint}</dd></div><div><dt>ID de petición OpenAI</dt><dd>{selected.requestId ?? "No disponible"}</dd></div><div><dt>ID de respuesta</dt><dd>{selected.responseId ?? "No disponible"}</dd></div><div><dt>Conversación local</dt><dd>{selected.conversationId ?? "Sin conversación asociada"}</dd></div><div><dt>Alias de alumnos</dt><dd>{selected.studentAliasCount}</dd></div><div><dt>Tokens</dt><dd>{selected.inputTokens ?? 0} entrada · {selected.outputTokens ?? 0} salida · {selected.totalTokens ?? 0} total</dd></div><div><dt>Inicio</dt><dd>{new Date(selected.createdAt).toLocaleString("es-ES")}</dd></div><div><dt>Duración</dt><dd>{selected.durationMs === null ? "En curso" : `${selected.durationMs} ms`}</dd></div></dl>}</> : <div className="detail-placeholder">Selecciona una petición.</div>}</div>
    </section>
    <p className="logs-privacy-note">Se guarda localmente el cuerpo seudonimizado enviado y la respuesta observable. Nunca se guardan cabeceras de autorización, tokens OAuth, nombres reales sustituidos ni razonamiento interno.</p>
    {showDelete && <div className="delete-dialog-backdrop" role="presentation"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-logs-title"><span>!</span><p className="eyebrow">Borrado de auditoría</p><h2 id="delete-logs-title">Borrar todos los logs de ChatGPT</h2><p>Esta operación no se puede deshacer. Escribe exactamente <strong>BORRAR LOGS</strong> para continuar.</p><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="BORRAR LOGS"/><div><button onClick={() => { setShowDelete(false); setConfirmation(""); }}>Cancelar</button><button className="danger" disabled={busy || confirmation !== "BORRAR LOGS"} onClick={() => void clear()}>{busy ? "Borrando…" : "Borrar definitivamente"}</button></div></section></div>}
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
