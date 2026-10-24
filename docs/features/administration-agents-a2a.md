# Agentes, estado y A2A

## Alcance

Catálogo de los siete agentes funcionales, estado operativo, arranque, parada, reinicio, estadísticas,
modelos generativos, consumo de tokens e historial de mensajes A2A internos y externos.

## Flujo actual

`admin-view.tsx` consulta las rutas `/api/admin/agents` y `/api/admin/a2a`. Los controles actualizan
`AgentRuntime`; el enrutado rechaza agentes detenidos. `internal-a2a-service.ts` registra delegaciones
tipadas entre módulos. `a2a-service.ts` expone la frontera A2A 1.0 local sin convertir agentes en procesos.
El panel y sus API requieren una sesión `admin`; también requieren ese rol la Agent Card y el endpoint A2A
externo. Los usuarios ordinarios no reciben enlaces a Administración en la navegación.

## Fuente de verdad e invariantes

- `src/agents/definitions.ts` y `registry.ts` son el catálogo funcional.
- `AgentExecution` contiene métricas, no razonamiento interno.
- `AgentConversation` y `AgentMessage` conservan solicitudes y respuestas estructuradas observables.
- Las métricas de tokens se agregan desde `CloudAiTrace`; nunca leen el contenido de la petición.
- En local las rutas escuchan en loopback; en Docker el bind es interno al bridge, el puerto del host se
  publica solo en loopback y el acceso remoto requiere Tailscale Serve y autenticación admin.
- A2A no evita la confirmación humana.
- La integración A2A está protegida por autenticación de Alfred; no se admite acceso anónimo en despliegue.
- No confundir estos agentes con el equipo de desarrollo de `.agents/`.

## Puntos de entrada

- UI: `src/components/admin-view.tsx`
- API: `src/app/api/admin/agents/route.ts`, `src/app/api/admin/agents/[id]/route.ts`,
  `src/app/api/admin/a2a/route.ts`, `src/app/api/a2a/message:send/route.ts`
- Servicios: `src/services/agent-admin-service.ts`, `src/services/internal-a2a-service.ts`,
  `src/services/a2a-service.ts`, `src/services/agent-ai-settings-service.ts`
- Contratos: `src/agents/contracts.ts`, `src/agents/a2a/contracts.ts`
- Pruebas: `tests/agents/registry.test.ts`, `tests/agents/a2a.test.ts`

## Checklist de cambio

- Probar agente disponible, detenido y reiniciado, más estadísticas tras ejecución.
- Contrastar total, entrada, salida y media por petición con trazas de uso conocidas.
- Validar mensajes A2A con Zod y no persistir prompts de sistema ni razonamiento.
- Cargar `cloud-ai-privacy-logs.md` al cambiar modelos o agentes generativos.
