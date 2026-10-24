# ChatGPT, privacidad y logs

## Alcance

Conexión con ChatGPT, catálogo de modelos, seudonimización de alumnado,
salida estructurada y panel de auditoría de peticiones cloud.

## Flujo actual

ChatGPT es el único proveedor seleccionado por la factoría para razonamiento generativo. El callback es
`http://127.0.0.1:<PORT>/auth/callback`, la ruta exacta publicada para el flujo open-source. Como loopback
no retorna directamente desde un iPhone hacia una VPS, la cuenta se autoriza ejecutando Alfred localmente
y se exporta únicamente el registro OAuth a un archivo 0600. La importación en producción conserva el
`hostId` y el secreto de alias propios de la VPS. El proveedor recibe contenido seudonimizado y
herramientas tipadas con `store: false` y streaming. La traza conserva metadatos
de operación, modelo, uso, duración y error, sin cuerpos de request/response. Los alias se revierten localmente al mostrar
la respuesta. El modelo efectivo puede configurarse por agente generativo y Administración agrega los
tokens por agente sin procesar el contenido de las trazas.
La reformulación de comentarios docentes reutiliza la misma pasarela: el nombre del alumno se sustituye
antes de enviar el texto y la respuesta se revierte localmente antes de guardar una propuesta.

## Fuente de verdad e invariantes

- Nombres, datos de contacto e identificadores internos del alumnado nunca viajan a la nube.
- Cada alumno se representa ante ChatGPT mediante un alias opaco HMAC de 256 bits, único dentro de la
  conversación y distinto entre conversaciones. El ID de SQLite nunca forma parte del alias visible.
- La frontera HTTP vuelve a inspeccionar el cuerpo completo justo antes de crear la traza o abrir la red.
  Si detecta cualquier nombre, apellido, ID interno, correo o teléfono conocido, bloquea la petición.
- No se registran tokens OAuth, cabeceras, prompts de sistema ni razonamiento interno.
- Las trazas nuevas no persisten cuerpos de petición ni respuesta. Las trazas históricas se redactan
  en la respuesta de administración; los cuerpos históricos no se exponen desde ese panel/API.
- No sustituir el callback open-source por un hostname tailnet. Una instancia cuyo `APP_ORIGIN` no sea
  loopback rechaza iniciar OAuth y espera una sesión importada conforme a la guía de VMs autohospedadas.
- Los archivos transferidos contienen tokens OAuth: permisos 0600, canal SSH, ausencia total de Git/logs
  y eliminación de la copia transitoria tras una importación verificada.
- Solo se aceptan endpoints oficiales fijados en código; el resto de URLs de IA debe ser loopback.
- Ningún modelo ejecuta SQL, comandos, rutas ni escrituras directas.

## Puntos de entrada

- Proveedor activo: `src/ai/providers/openai-responses-provider.ts`,
  `src/ai/providers/provider-factory.ts`, `src/ai/providers/llm-provider.ts`
- Autenticación: `src/services/chatgpt-auth-service.ts`, `src/app/api/auth/chatgpt/route.ts`,
  `src/app/api/auth/chatgpt/start/route.ts`, `src/app/auth/callback/route.ts`,
  `scripts/manage-chatgpt-credentials.ts`
- Privacidad: `src/services/student-pseudonymization-service.ts`
- Logs: `src/services/cloud-ai-log-service.ts`, `src/repositories/cloud-ai-log-repository.ts`,
  `src/app/api/admin/logs/route.ts`
- Modelos: `src/services/agent-ai-settings-service.ts`, `src/app/api/admin/ai-models/route.ts`
- Pruebas: `tests/ai/openai-responses-provider.test.ts`, `tests/privacy/student-pseudonymization.test.ts`,
  `tests/privacy/no-external-runtime.test.ts`

## Checklist de cambio

- Security y reviewer son obligatorios.
- Inspeccionar una traza ficticia y demostrar que solo expone metadatos, sin cuerpos, nombres ni IDs internos.
- Demostrar que una identidad real inyectada directamente en el proveedor impide tanto la traza como `fetch`.
- Probar corte de emergencia, error remoto, modelo no disponible, transferencia de credenciales y borrado de logs.
- Actualizar `.env.example`, README y guía offline si cambia configuración.
