# Decisiones técnicas

## ADR-001 · Monolito modular con Route Handlers

Next.js concentra UI y backend local, reduce procesos y simplifica la instalación. Los límites se
preservan por módulos y servicios. Los agentes internos no se convierten en microservicios; la
interoperabilidad A2A se implementa únicamente como adaptador en el borde HTTP local.

## ADR-002 · Prisma 7, no Prisma 8

En octubre de 2026 Prisma 8 todavía presenta SQLite como experimental, mientras Prisma 7 sigue
soportado. Se fija la rama 7 y se usa el adaptador oficial `better-sqlite3`. El lockfile conserva las
versiones exactas resueltas. Revisar esta decisión antes de una actualización mayor.

## ADR-003 · `qwen3.5:9b` como perfil funcional (sustituida)

El Mac detectado dispone de Apple M4 y 16 GB. El perfil inicial `qwen3:4b` era adecuado para validar
la integración local, pero no ofrece el margen de calidad requerido para convertir Alfred en una
herramienta diaria. Se adopta `qwen3.5:9b` como perfil funcional por su mejor seguimiento de
instrucciones, razonamiento y uso de herramientas, manteniendo Ollama en loopback. El modelo ocupa
aproximadamente 6,6–7,6 GB según la variante publicada. `qwen3:4b` queda limitado al desarrollo rápido.

El cambio de modelo no constituye por sí solo una garantía: las intenciones de alto riesgo se enrutan
mediante reglas deterministas, todas las herramientas tienen esquemas Zod, las entidades se resuelven
contra SQLite y las escrituras requieren una `PendingAction`. `npm run ai:eval` forma parte de la
validación del modelo configurado.

Esta decisión queda sustituida por ADR-013. El adaptador permanece como referencia de compatibilidad,
pero el producto no lo selecciona durante la ejecución.

## ADR-004 · HTTP nativo para Ollama (sustituida)

Se usa `fetch` de Node en vez de un SDK adicional. El proveedor acepta únicamente hosts loopback,
aplica timeout, JSON Schema y validación Zod. ADR-013 sustituye su uso como proveedor activo.

## ADR-005 · Confirmación idempotente

`PendingAction` conserva el payload validado y una clave única. Confirmar debe ejecutar exactamente
ese payload dentro de una transacción. Esto evita que una regeneración del LLM o un reintento cambie
o duplique la operación.

## ADR-006 · Sin base vectorial mientras no exista una necesidad demostrada

Consultas relacionales e índices cubren los escenarios conocidos. FTS5 podrá evaluarse cuando exista
una necesidad de búsqueda textual demostrada. Se evita complejidad y memoria duplicada.

## ADR-007 · Recurrencia separada de sesiones concretas

El horario habitual se modela con `WeeklyTimetable` y `TimetableSlot`; cada fecha real se materializa
como `LessonPlan`. La clave única por franja y fecha evita duplicados. El día se guarda como fecha UTC
normalizada y las horas como minutos desde medianoche en la zona del horario. Así no se desplazan las
clases por horario de verano y la lógica es idéntica en macOS y Windows.

## ADR-008 · Progreso basado en confirmaciones

Las propuestas de actividades pueden proceder de ChatGPT, pero duración, solapamientos, recurrencia y
progreso se calculan en servicios deterministas. `LessonExecution` conserva cada confirmación y
`PlanningChange` registra versiones antes/después sin sobrescribir silenciosamente el historial.

## ADR-009 · Contexto centralizado antes de delegar

Alfred resuelve el foco conversacional antes de invocar un agente. El modelo propone referencias y
tema mediante un esquema Zod, y los servicios validan cualquier nombre contra los alumnos existentes
antes de convertirlo en un identificador. El foco se guarda por conversación y no se trata como un
hecho docente. Esto permite continuaciones naturales para cualquier agente sin acoplarlos al texto del
chat. A2A no resuelve por sí mismo correferencias o memoria: reutiliza el contexto ya resuelto y no
introduce llamadas de red entre módulos.

## ADR-010 · La intención prevalece sobre el contexto visual

La pantalla actual aporta referencias, nunca intención. Ver la ficha de un alumno permite resolver
«él» o «ella», pero no autoriza a interpretar cualquier frase como una observación. Alfred distingue
si el alumno fue nombrado directamente, heredado del diálogo o simplemente visible; una operación de
la aplicación, como crear una clase, se clasifica antes de considerar una escritura sobre alumnado.
Las órdenes inequívocas de creación o control tienen un enrutado determinista que el modelo no puede
degradar a otra mutación.

## ADR-011 · A2A 1.0 como adaptador local, sin framework adicional

Alfred publica una Agent Card en `/.well-known/agent-card.json` y una interfaz HTTP+JSON A2A 1.0 en
`/api/a2a`. La tarjeta presenta Alfred como el agente remoto y agrupa los módulos internos en skills;
no expone cada módulo como proceso ni como puerto independiente. `contextId` reutiliza las
conversaciones existentes y las mutaciones devuelven referencias a `PendingAction`, conservando la
confirmación humana.

Se implementa el subconjunto anunciado por la tarjeta: mensajes síncronos de texto y partes de datos.
Streaming, push y tareas persistentes se declaran como no soportados. No se incorpora un SDK porque
la frontera necesaria es pequeña, se valida con Zod y añadir un framework de agentes aumentaría la
superficie de dependencias. En local el endpoint usa `127.0.0.1`; el despliegue Docker lo enlaza dentro
del bridge y exige sesión `admin`, con publicación host solo en loopback detrás de Tailscale Serve.

## ADR-012 · Binding A2A 1.0 interno y auditable

La delegación de Alfred a los seis agentes especializados usa un transporte síncrono en proceso con
el modelo de datos A2A 1.0. Cada llamada genera un `Message`, una `Task` con estado terminal y un
`Artifact` con el resultado estructurado. El registro persistente permite inspección operativa sin
guardar prompts ni razonamiento interno. Se evita el SDK oficial porque no se necesitan red, streaming
ni push para módulos del mismo monolito; los contratos mantienen nombres y semántica de A2A 1.0 y
están cubiertos por pruebas de regresión.

## ADR-013 · ChatGPT como proveedor generativo con seudonimización local

ChatGPT es el único proveedor que selecciona Alfred para interpretación y razonamiento generativo. Las
reglas locales se reservan para validación, cálculos reproducibles, resolución de entidades y controles
de seguridad. La profesora autoriza la cuenta mediante **Continuar con ChatGPT**, usando OIDC con PKCE.
Las credenciales se guardan en el runtime, nunca en el navegador.
Todas las inferencias usan Responses API con `store: false` y `stream: true`.

En local se conserva el callback loopback del cliente open-source. En una instancia HTTPS, el botón usa
un cliente OAuth web público registrado por OpenAI para el callback exacto de Alfred. El registro web de
identidad no asegura por sí mismo permiso de uso del plan; Alfred exige `chatgpt.tokens.use.direct` para
inferir. No se transfiere ninguna sesión desde otro equipo.

Antes de salir del proceso, una pasarela sustituye nombres, identificadores de SQLite y datos de
contacto por alias opacos derivados por conversación. Las observaciones, calificaciones y demás hechos
pueden acompañar al alias para conservar capacidad de razonamiento. Las llamadas de herramientas se
traducen de vuelta localmente, se validan con Zod y siguen sujetas a `PendingAction`. Los endpoints de
OpenAI están fijados en código; no se admite configurar destinos cloud arbitrarios.

El alias usa el HMAC-SHA-256 completo del ID local y la conversación, por lo que cada alumno conserva una
referencia única durante ese chat sin revelar el ID ni permitir correlacionarlo entre conversaciones. Como
defensa obligatoria, el proveedor no puede construirse sin un guard de salida: inmediatamente antes de
registrar o transmitir una petición, este compara todo el payload con el censo local y bloquea nombres,
apellidos, IDs y datos de contacto que hayan sobrevivido a la seudonimización.

## ADR-014 · Auditoría local de llamadas a ChatGPT

Cada invocación a Responses API crea una entrada `CloudAiTrace` antes de realizar la conexión. Se conservan
solo metadatos operativos: proveedor, modelo, operación, identificadores de soporte, uso y duración. Las
trazas nuevas no guardan cuerpos de petición o respuesta ni mensajes de error potencialmente sensibles.
La petición no se envía si no puede iniciarse su traza.

La interfaz **Administración → Logs** permite buscar, filtrar y borrar estos registros con confirmación
reforzada. La API y el explorador de base de datos redactan también los cuerpos y mensajes sensibles de
trazas históricas. No se borran automáticamente: su eliminación requiere una decisión administrativa.

## ADR-015 · Modelo configurable por agente generativo

`AgentRuntime.aiModel` conserva una preferencia opcional para cada agente que declara `usesAi`. La lista
seleccionable se consulta al catálogo de modelos de la cuenta conectada y una elección se valida contra
ese catálogo antes de persistirse. Sin preferencia, el agente hereda el modelo efectivo de la sesión.

Solo Alfred, MemoryAgent y TutoringAgent exponen el selector porque son los módulos que realizan
inferencias generativas. Los demás agentes ejecutan reglas y servicios deterministas; mostrarles una
preferencia que nunca utilizan sería engañoso. Cada `CloudAiTrace` conserva además el `agentId` y el modelo
efectivo para que la configuración sea auditable.

## ADR-016 · Markdown seguro como formato de presentación

Las respuestas generativas admiten un subconjunto explícito de Markdown: encabezados, énfasis, código,
enlaces HTTP(S), citas, listas y tablas. Un renderizador propio crea nodos React y no interpreta HTML
crudo ni usa `dangerouslySetInnerHTML`. El historial lateral elimina las marcas y presenta un resumen
en texto plano. De esta forma el formato solicitado al modelo se visualiza correctamente sin convertir
su salida en una superficie de inyección.

## ADR-017 · Exportación XLSX acotada y local

El módulo de exportación usa `write-excel-file` en el servidor local para crear libros `.xlsx` reales sin
incorporar una suite de hojas de cálculo al cliente. La biblioteca es multiplataforma, requiere Node 18 o
superior y añade únicamente compresión como dependencia transitiva. Se descartó ExcelJS porque la versión
actual introducía una dependencia de producción con vulnerabilidad conocida en la auditoría de npm.

Los conjuntos exportables son un catálogo cerrado y cada consulta se implementa como read model; el usuario
no puede aportar SQL, nombres de tabla ni rutas. CSV se limita a un conjunto y Excel usa una hoja por conjunto.
Ambos formatos neutralizan texto con prefijos interpretables como fórmula. Los logs se exportan solo como
metadatos de uso: no incluyen cuerpos de petición o respuesta, credenciales ni razonamiento interno.

## ADR-018 · Comentarios docentes revisables para tutoría

Los comentarios recibidos de otros profesores se conservan en `TeacherFeedback`, separados tanto de las
calificaciones por asignatura como de las observaciones generales. El texto original es inmutable desde el
flujo de revisión; una segunda versión puede proceder de Alfred y siempre se identifica como propuesta.

La profesora puede editar esa propuesta y debe confirmarla antes de asociarla a la próxima `TutoringSession`.
La preparación posterior reutiliza la sesión en borrador para no separar los comentarios de la reunión. Si
interviene ChatGPT, el contenido pasa por la seudonimización local existente; sin conexión se ofrece el texto
original como borrador editable, sin fingir una reformulación generativa.

## ADR-019 · Cuentas locales con espacio docente compartido

La aplicación incorpora `AppUser` y `AppSession` en SQLite para autenticar a cada persona y reservar las
operaciones administrativas al rol `admin`. El hash del token, y no el token de sesión, se persiste; las
cuentas se administran desde el CLI local sin endpoint de registro. La duración de sesión es limitada y
las mutaciones validan origen y CSRF.

Los datos docentes existentes no tienen propietario por profesor. Por tanto, los roles distinguen acceso
y capacidades administrativas, pero las cuentas autorizadas comparten alumnado, conversaciones y el
resto del espacio docente. No se introduce migración de ownership ni asignación automática de registros,
porque cambiaría la semántica y podría ocultar datos existentes. El aislamiento por usuario requeriría una
decisión de producto y una migración separada.

## ADR-020 · Una instancia SQLite tras un proxy privado

La imagen Docker ejecuta un solo proceso de Alfred como usuario sin privilegios y conserva `/app/data`
en un volumen. El bridge publica el puerto solo en loopback del host para que Tailscale Serve proporcione
HTTPS privado. Se evita `network_mode: host` y no se arranca una segunda réplica sobre la misma base.
El entrypoint aplica migraciones Prisma sin seed antes de servir tráfico; backup y rollback documentan
una copia completa del volumen con el proceso detenido.

El callback del cliente open-source permanece en loopback. El despliegue HTTPS requiere un cliente OAuth
web registrado por OpenAI y una URL de retorno exacta. Compose deja el ID sin configurar hasta obtener
ese registro; el corte de emergencia cloud continúa disponible.

## Licencias directas

Next.js, React, Tailwind CSS, Zod, Vitest y `better-sqlite3` usan licencias permisivas; Prisma y Qwen3
usan Apache 2.0. Antes de distribuir, generar y revisar un inventario completo de dependencias
transitivas y conservar avisos de licencia. Esta revisión inicial no sustituye asesoramiento legal.
