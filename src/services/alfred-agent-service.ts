import { OllamaProvider } from "@/ai/providers/ollama-provider";
import { LlmUnavailableError, type LlmChatMessage } from "@/ai/providers/llm-provider";
import { sanitizeFinalAnswer } from "@/ai/final-answer";
import { alfredToolDefinitions, executeAlfredTool, type AlfredToolResult } from "@/agents/alfred-tools";
import { loadConfig } from "@/config/env";
import type { ChatPageContext } from "@/domain/chat";
import type { ConversationContextState, ConversationTurn } from "@/services/conversation-context-service";
import { randomUUID } from "node:crypto";
import { resolveStudents } from "@/services/student-service";

function compactState(state: ConversationContextState) {
  if (!state.lastTool) return { activeStudentIds: state.activeStudentIds, topic: state.topic, lastTool: null };
  const serializedResult = JSON.stringify(state.lastTool.result);
  return {
    activeStudentIds: state.activeStudentIds,
    topic: state.topic,
    lastTool: {
      name: state.lastTool.name,
      arguments: state.lastTool.arguments,
      result: serializedResult.length > 5_000 ? `${serializedResult.slice(0, 5_000)}…` : state.lastTool.result,
      summary: state.lastTool.summary,
    },
  };
}

export function buildAlfredSystemPrompt(state: ConversationContextState, pageContext?: ChatPageContext) {
  return `Eres Alfred, el único asistente visible de una aplicación docente local. Hablas en español claro, natural y conciso.

REGLAS DE OPERACIÓN:
- Para consultar datos de la aplicación o proponer cambios, usa las herramientas disponibles. Nunca inventes datos ni respondas desde conocimiento supuesto.
- Mantén intención, filtros, entidades y resultados entre turnos. Expresiones como «ellos», «quiénes son», «solo los de segundo», «y mañana» o «hazme una tabla» modifican o presentan el estado previo; no reinician la consulta.
- Una pregunta pendiente no bloquea el chat. Si el mensaje actual expresa una tarea nueva y completa en vez de aportar los datos solicitados, cambia de intención y atiende la tarea nueva.
- Hereda únicamente los campos compatibles con la petición actual; no mezcles entidades, filtros ni objetivos de temas distintos.
- Una afirmación concreta sobre un alumno identificable, cuando no es una pregunta, es una nueva solicitud para preparar una observación con propose_record_observation. Nunca la uses para rellenar campos pendientes de una clase, horario u otra entidad.
- No pidas apellido, clase ni categoría técnica antes de consultar o proponer. Envía a la herramienta la referencia tal como la dijo la profesora: los servicios comprueban si es única y devolverán candidatos si hay ambigüedad. Infiere la categoría de una observación cuando sea evidente y usa general en caso contrario.
- Si el último resultado ya contiene la respuesta, puedes contestar directamente sin repetir la herramienta.
- El contexto de pantalla solo ayuda a resolver referencias. Nunca convierte por sí mismo una frase en una observación o una operación.
- Si falta un dato obligatorio o una entidad es ambigua, pregunta únicamente lo necesario. No llames una herramienta de escritura con datos inventados.
- Si la profesora da varios alumnos para una misma clase, usa propose_create_students_bulk una sola vez y conserva todos los nombres y apellidos.
- Si describe las clases que imparte y sus horas, usa propose_create_teaching_schedule. Convierte cada día mencionado en una franja distinta, pero nunca inventes la hora final ni el curso académico.
- No preguntes por parámetros opcionales que tengan valor predeterminado. Llama a la herramienta sin ellos; el servicio aplicará el valor seguro o devolverá una ambigüedad concreta.
- Las herramientas cuyo nombre empieza por propose_ crean propuestas pendientes. Nunca afirmes que el cambio ya está guardado.
- Después de recibir resultados de herramientas, responde solo con la respuesta final. No menciones nombres técnicos, JSON, agentes internos ni razonamientos.
- Si la petición no necesita datos ni acciones de la aplicación, responde conversacionalmente sin herramienta.

ESTADO ESTRUCTURADO DEL CHAT:
${JSON.stringify(compactState(state))}

PANTALLA VISIBLE (contexto transitorio, no intención):
${pageContext ? JSON.stringify(pageContext) : "Ninguna"}`;
}

export interface AlfredAgentRunResult {
  content: string;
  agentId: string;
  state: ConversationContextState;
  pendingAction?: AlfredToolResult["pendingAction"];
  artifact?: AlfredToolResult["artifact"];
}

function claimsToolWorkWithoutEvidence(content: string) {
  return /\b(?:he|hemos)\s+(?:preparado|generado|consultado|encontrado|registrado|guardado|creado|organizado|calculado)\b/i.test(content)
    || /\b(?:propuesta|borrador)\s+(?:est[aá]|queda)\s+(?:preparad[oa]|cread[oa])\b/i.test(content);
}

function needsApplicationGrounding(message: string) {
  return /\b(?:alumn\w*|estudiant\w*|clase\w*|grupo\w*|observaci\w*|alerg\w*|intoler\w*|tutor[ií]a\w*|familia\w*|asiento\w*|pupitre\w*|aula\w*|horario\w*|planificaci\w*|sesi[oó]n\w*|sesiones|asignatura\w*|curr[ií]cul\w*|unidad\w*|contenido\w*|agente\w*|base de datos|registro\w*)\b/iu.test(message);
}

function isMissingInformationQuestion(content: string) {
  return /\b(?:necesito|falta|faltan|indica|ind[ií]came|proporciona|puedes decirme|puedes concretar)\b/i.test(content);
}

function asksForAlreadyResolvableStudent(content: string, resolvedStudentCount: number) {
  return resolvedStudentCount === 1
    && isMissingInformationQuestion(content)
    && /\b(?:nombre completo|apellidos?|clase|grupo)\b/i.test(content);
}

function compactTurn(content: string, limit: number) {
  return content.length > limit ? `${content.slice(0, limit)}…` : content;
}

export async function runAlfredAgent(input: {
  conversationId?: string;
  message: string;
  history: ConversationTurn[];
  state: ConversationContextState;
  pageContext?: ChatPageContext;
}): Promise<AlfredAgentRunResult | null> {
  const config = loadConfig();
  const provider = new OllamaProvider({
    baseUrl: config.OLLAMA_BASE_URL,
    model: config.OLLAMA_MODEL,
    timeoutMs: 120_000,
  });
  const messages: LlmChatMessage[] = [
    { role: "system", content: buildAlfredSystemPrompt(input.state, input.pageContext) },
    ...input.history.slice(-10).map((turn): LlmChatMessage => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: compactTurn(turn.content, turn.role === "assistant" ? 1_600 : 2_000),
    })),
    { role: "user", content: input.message },
  ];

  let state = input.state;
  let agentId = "alfred-orchestrator";
  let pendingAction: AlfredToolResult["pendingAction"];
  let artifact: AlfredToolResult["artifact"];
  let exactResponse = "";
  let lastSummary = "";
  const a2aContext = { requestId: randomUUID(), userConversationId: input.conversationId };
  const resolvedInputStudents = needsApplicationGrounding(input.message)
    ? await resolveStudents(input.message)
    : [];

  try {
    for (let step = 0; step < 4; step += 1) {
      const response = await provider.chat(messages, alfredToolDefinitions, {
        temperature: 0,
        contextLength: config.OLLAMA_CONTEXT_LENGTH,
      });
      const calls = response.message.toolCalls ?? [];
      if (!calls.length) {
        const content = sanitizeFinalAnswer(response.message.content);
        const requiresCorrection = !lastSummary && content && (
          claimsToolWorkWithoutEvidence(content)
          || (needsApplicationGrounding(input.message) && !isMissingInformationQuestion(content))
          || asksForAlreadyResolvableStudent(content, resolvedInputStudents.length)
        );
        if (requiresCorrection && step < 3) {
          messages.push(response.message);
          messages.push({
            role: "system",
            content: "Corrección de seguridad: esta petición se refiere a datos o funciones de Alfred, pero no has ejecutado ninguna herramienta. No inventes limitaciones ni presentes trabajo ficticio. Revisa todo el catálogo y ejecuta ahora la herramienta adecuada; los filtros pueden quedar vacíos para consultar el conjunto completo. Si faltan datos realmente obligatorios, limita la respuesta a pedirlos sin afirmar que la operación está preparada.",
          });
          continue;
        }
        if (requiresCorrection) return null;
        if (!content && !exactResponse && !lastSummary) return null;
        return {
          content: exactResponse || content || lastSummary,
          agentId,
          state,
          pendingAction,
          artifact,
        };
      }

      messages.push(response.message);
      for (const call of calls) {
        const toolResult = await executeAlfredTool(call.function.name, call.function.arguments, a2aContext);
        agentId = toolResult.agentId;
        pendingAction ??= toolResult.pendingAction;
        artifact ??= toolResult.artifact;
        lastSummary = toolResult.summary;
        if (toolResult.exactResponse) exactResponse = toolResult.exactResponse;
        state = {
          version: 2,
          activeStudentIds: toolResult.activeStudentIds ?? state.activeStudentIds,
          topic: toolResult.topic,
          lastTool: {
            name: call.function.name,
            arguments: call.function.arguments,
            result: toolResult.modelResult,
            summary: toolResult.summary.slice(0, 2_000),
          },
        };
        messages.push({
          role: "tool",
          toolName: call.function.name,
          content: JSON.stringify(toolResult.modelResult),
        });
      }

      // Mutation and ambiguity responses contain authoritative wording. Do not let
      // a second model pass alter the exact proposal or imply it was executed.
      if (exactResponse) {
        return { content: exactResponse, agentId, state, pendingAction, artifact };
      }
    }
    return lastSummary ? { content: lastSummary, agentId, state, pendingAction, artifact } : null;
  } catch (error) {
    if (error instanceof LlmUnavailableError) return null;
    throw error;
  }
}
