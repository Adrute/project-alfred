# Alfred y conversaciones

## Alcance

Identidad única de Alfred, conversaciones independientes, contexto de seguimientos, asistente flotante,
selección y ejecución de herramientas, confirmaciones y representación segura de respuestas.

## Flujo actual

`alfred-app.tsx` envía mensaje, conversación y contexto de pantalla a `/api/chat`. `chat-service.ts`
recupera historial y estado estructurado, solicita una decisión tipada al orquestador, delega al agente
propietario y persiste solo la respuesta final. Las mutaciones devuelven una `PendingAction`; no se aplican
hasta la confirmación explícita. El chat completo y la burbuja muestran siempre la identidad Alfred.

## Fuente de verdad e invariantes

- `Conversation` y `Message` guardan cada hilo; `Conversation.contextJson` conserva foco y último resultado.
- El historial ayuda a interpretar pronombres o continuaciones, pero las tablas de dominio aportan los hechos.
- El modelo no puede afirmar una consulta o escritura que no haya ejecutado una herramienta real.
- La salida se renderiza mediante `markdown-message.tsx`, sin HTML del modelo.
- La UI debe conservar scroll del historial y dejar accesible el compositor.

## Puntos de entrada

- UI: `src/components/alfred-app.tsx`, `src/components/markdown-message.tsx`
- API: `src/app/api/chat/route.ts`, `src/app/api/actions/[id]/confirm/route.ts`
- Servicios: `src/services/chat-service.ts`, `src/services/alfred-agent-service.ts`,
  `src/services/ai-orchestrator-service.ts`, `src/services/conversation-context-service.ts`,
  `src/services/action-service.ts`
- Contratos: `src/domain/chat.ts`, `src/domain/actions.ts`, `src/agents/alfred-tools.ts`
- Pruebas: `tests/domain/student-context.test.ts`, `tests/integration/observation-flow.test.ts`,
  `tests/ui/markdown-message.test.ts`, `tests/e2e/demo.spec.ts`

## Checklist de cambio

- Probar pregunta inicial, continuación elíptica y aislamiento entre conversaciones.
- Verificar contexto de pantalla tanto en chat como en burbuja.
- Añadir regresión si cambia enrutado, memoria, formato o confirmación.
- Cargar además la ficha del dominio de cualquier herramienta nueva.
