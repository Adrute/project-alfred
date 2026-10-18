import { loadConfig } from "@/config/env";
import {
  A2A_PROTOCOL_VERSION,
  a2aSendMessageRequestSchema,
  type A2AAgentCard,
  type A2AMessageResponse,
  type A2ASendMessageRequest,
} from "@/agents/a2a/contracts";
import { handleChat } from "@/services/chat-service";

type ChatHandler = typeof handleChat;

const skills: A2AAgentCard["skills"] = [
  {
    id: "teacher-assistance",
    name: "Asistencia docente conversacional",
    description: "Mantiene conversaciones contextualizadas y coordina capacidades docentes locales.",
    tags: ["education", "conversation", "orchestration"],
    examples: ["¿Qué sabes de este alumno?", "Dime quiénes son"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  },
  {
    id: "student-memory",
    name: "Alumnado y memoria estructurada",
    description: "Consulta alumnos, observaciones, relaciones y adaptaciones alimentarias confirmadas.",
    tags: ["students", "memory", "observations"],
    examples: ["Dime los alumnos cuyo nombre empieza por E", "¿Hay alergias alimentarias registradas?"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  },
  {
    id: "tutoring",
    name: "Tutorías",
    description: "Prepara tutorías familiares a partir de hechos confirmados.",
    tags: ["tutoring", "families"],
    examples: ["Prepárame una tutoría con la familia de Lucas"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  },
  {
    id: "classroom-organization",
    name: "Organización del aula",
    description: "Propone distribuciones de asientos respetando restricciones registradas.",
    tags: ["classroom", "seating", "planning"],
    examples: ["Organiza los 25 alumnos en cinco filas de cinco"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  },
  {
    id: "teaching-planning",
    name: "Planificación y currículo",
    description: "Consulta horarios, sesiones, asignaturas, unidades, contenidos y progreso.",
    tags: ["planning", "curriculum", "schedule"],
    examples: ["¿Qué clases tengo mañana?", "¿Cómo va la unidad actual?"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  },
  {
    id: "safe-proposals",
    name: "Propuestas confirmables",
    description: "Prepara cambios tipados sin ejecutarlos hasta recibir confirmación explícita en Alfred.",
    tags: ["human-in-the-loop", "pending-action", "safety"],
    examples: ["Lucas participa mucho en clase", "Quiero crear una clase nueva"],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  },
];

export function getA2AAgentCard(): A2AAgentCard {
  const config = loadConfig();
  const interfaceUrl = new URL("http://127.0.0.1/api/a2a");
  interfaceUrl.hostname = config.HOST;
  interfaceUrl.port = String(config.PORT);
  return {
    name: "Alfred",
    description: "Asistente docente local, privado y contextual con memoria estructurada y confirmación humana.",
    supportedInterfaces: [{
      url: interfaceUrl.toString().replace(/\/$/, ""),
      protocolBinding: "HTTP+JSON",
      protocolVersion: A2A_PROTOCOL_VERSION,
    }],
    version: "0.1.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills,
  };
}

function textFromRequest(request: A2ASendMessageRequest) {
  return request.message.parts
    .flatMap((part) => "text" in part ? [part.text] : [])
    .join("\n")
    .trim();
}

export async function sendA2AMessage(raw: unknown, chatHandler: ChatHandler = handleChat): Promise<A2AMessageResponse> {
  const request = a2aSendMessageRequestSchema.parse(raw);
  if (request.message.taskId) {
    throw new Error("Alfred no anuncia tareas A2A persistentes; continúa mediante contextId.");
  }
  const message = textFromRequest(request);
  if (!message) throw new Error("Alfred admite actualmente entradas A2A de tipo text/plain.");

  const response = await chatHandler({
    conversationId: request.message.contextId,
    message,
  });
  const parts: A2AMessageResponse["message"]["parts"] = [{ text: response.message.content }];
  if (response.pendingAction) {
    parts.push({
      data: {
        kind: "pending_action",
        id: response.pendingAction.id,
        operation: response.pendingAction.operation,
        status: response.pendingAction.status,
        confirmationRequired: true,
      },
    });
  }
  if (response.artifact) {
    parts.push({ data: { kind: "alfred_artifact", type: response.artifact.type } });
  }

  return {
    message: {
      messageId: response.message.id,
      contextId: response.conversationId,
      role: "ROLE_AGENT",
      parts,
    },
  };
}
