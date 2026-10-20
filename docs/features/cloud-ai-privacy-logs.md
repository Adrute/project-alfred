# ChatGPT, privacidad y logs

## Alcance

Conexión opcional con ChatGPT, proveedores de IA, catálogo de modelos, seudonimización de alumnado,
salida estructurada y panel de auditoría de peticiones cloud.

## Flujo actual

La aplicación funciona manualmente sin sesión. Al conectar ChatGPT, el proveedor recibe contenido
seudonimizado y herramientas tipadas con `store: false`. Antes de enviar, crea una traza; al terminar
registra respuesta observable, modelo, uso, duración y error. Los alias se revierten localmente al mostrar
la respuesta. El modelo efectivo puede configurarse por agente generativo.

## Fuente de verdad e invariantes

- Nombres, datos de contacto e identificadores internos del alumnado nunca viajan a la nube.
- No se registran tokens OAuth, cabeceras, prompts de sistema ni razonamiento interno.
- La traza conserva exactamente el cuerpo seudonimizado auditable, no el original local.
- Solo se aceptan endpoints oficiales fijados en código; el resto de URLs de IA debe ser loopback.
- Ningún modelo ejecuta SQL, comandos, rutas ni escrituras directas.

## Puntos de entrada

- Proveedores: `src/ai/providers/openai-responses-provider.ts`, `src/ai/providers/ollama-provider.ts`,
  `src/ai/providers/provider-factory.ts`, `src/ai/providers/llm-provider.ts`
- Autenticación: `src/services/chatgpt-auth-service.ts`, `src/app/api/auth/chatgpt/route.ts`,
  `src/app/api/auth/chatgpt/start/route.ts`, `src/app/api/auth/chatgpt/callback/route.ts`
- Privacidad: `src/services/student-pseudonymization-service.ts`
- Logs: `src/services/cloud-ai-log-service.ts`, `src/repositories/cloud-ai-log-repository.ts`,
  `src/app/api/admin/logs/route.ts`
- Modelos: `src/services/agent-ai-settings-service.ts`, `src/app/api/admin/ai-models/route.ts`
- Pruebas: `tests/ai/openai-responses-provider.test.ts`, `tests/privacy/student-pseudonymization.test.ts`,
  `tests/privacy/no-external-runtime.test.ts`

## Checklist de cambio

- Security y reviewer son obligatorios.
- Inspeccionar el cuerpo real de una prueba ficticia y demostrar ausencia de nombres e IDs internos.
- Probar modo desconectado, error remoto, modelo no disponible y borrado de logs.
- Actualizar `.env.example`, README y guía offline si cambia configuración.
