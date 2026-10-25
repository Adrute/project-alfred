# ChatGPT, privacidad y logs

## Alcance

Conexión con ChatGPT, catálogo de modelos, seudonimización de alumnado,
salida estructurada y panel de auditoría de peticiones cloud.

## Flujo actual

ChatGPT es el único proveedor seleccionado por la factoría para razonamiento generativo. En local usa
`http://127.0.0.1:<PORT>/auth/callback`; en una instancia HTTPS usa `<APP_ORIGIN>/auth/callback` con un
cliente OAuth público registrado por OpenAI. El administrador pulsa **Continuar con ChatGPT**, autoriza
en OpenAI y regresa a Alfred. El proveedor recibe contenido seudonimizado y
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
- Una instancia HTTPS exige `CHATGPT_OAUTH_CLIENT_ID` de un cliente web público registrado para el
  callback exacto. No usa el cliente dinámico open-source con un callback remoto.
- ChatGPT está habilitado por defecto también en local; `CLOUD_AI_ENABLED=false` corta expresamente
  las conexiones cloud y oculta el botón de acceso. La cabecera usa el estado del servidor desde el
  primer render y no presenta una desactivación transitoria mientras carga el detalle de la cuenta.
- La autorización se vincula a la sesión admin iniciadora; `state` se consume una vez, y la inferencia
  requiere que el token conceda `chatgpt.tokens.use.direct`.
- Las autorizaciones nuevas guardan la ruta de callback para reusarla. Un registro local anterior sin
  metadatos puede requerir `CHATGPT_LOCAL_CALLBACK_PATH=/api/auth/chatgpt/callback` si se creó con la
  ruta histórica; el valor solo se aplica a ese registro existente. Los registros nuevos usan
  `/auth/callback`.
- Solo se aceptan endpoints oficiales fijados en código; el resto de URLs de IA debe ser loopback.
- Ningún modelo ejecuta SQL, comandos, rutas ni escrituras directas.

## Puntos de entrada

- Proveedor activo: `src/ai/providers/openai-responses-provider.ts`,
  `src/ai/providers/provider-factory.ts`, `src/ai/providers/llm-provider.ts`
- Autenticación: `src/services/chatgpt-auth-service.ts`, `src/app/api/auth/chatgpt/route.ts`,
  `src/app/api/auth/chatgpt/start/route.ts`, `src/app/auth/callback/route.ts`,
  `src/config/env.ts`
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
- Probar corte de emergencia, error remoto, modelo no disponible, callback OAuth y borrado de logs.
- Actualizar `.env.example`, README y guía offline si cambia configuración.
