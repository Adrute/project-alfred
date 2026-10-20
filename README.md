<p align="center">
  <img src="public/images/alfred-avatar-bellhop.png" alt="Avatar de Alfred" width="190" />
</p>

<h1 align="center">¡Hola! Soy Alfred</h1>

<p align="center">
  <strong>Tu asistente docente inteligente, privado y local.</strong><br />
  Estoy aquí para ayudarte a organizar tus clases, acompañar a tu alumnado y preparar cada día con más calma.
</p>

Alfred es una plataforma local-first de asistencia docente. La aplicación combina una interfaz web en
Next.js, memoria estructurada en SQLite y siete agentes coordinados. Funciona manualmente sin ninguna
cuenta externa y permite conectar opcionalmente ChatGPT para comprender lenguaje natural y realizar
razonamientos avanzados. Los nombres del alumnado y los datos de contacto se sustituyen localmente por
alias antes de cada petición; las decisiones y escrituras se validan siempre en código.

## Estado

La base funcional está implementada: múltiples conversaciones independientes con
historial y contexto propio, Alfred disponible como asistente flotante consciente de la pantalla,
confirmaciones idempotentes, gestión de clases y altas masivas de alumnos, observaciones editables y confirmadas,
recuperación de memoria, tutorías asistidas opcionalmente por ChatGPT, acuerdos, solver determinista de
asientos y plano 5×5 editable. La primera fase del Planificador Docente añade horarios recurrentes,
asignaturas, unidades, contenidos, sesiones idempotentes, creación de horarios completos por lenguaje
natural y un organizador semanal editable. **Mis asignaturas** separa cada combinación de asignatura y
grupo e incorpora una ficha académica por alumno con calificaciones ponderadas, progreso, participación,
tareas, notas y apoyos. **Mi tutoría** es un espacio independiente para el grupo tutor, el seguimiento
general, las reuniones familiares y sus acuerdos. El panel
de Administración muestra los siete agentes, su estado, capacidades, actividad y estadísticas;
permite controlarlos, elegir el modelo de ChatGPT de cada agente generativo, revisar sus intercambios A2A 1.0 y auditar en **Logs** el contenido seudonimizado
enviado a ChatGPT, la respuesta observable, el modelo, tokens, duración y errores. También permite explorar
SQLite y borrar registros o áreas con confirmación reforzada. El
recorrido crítico está automatizado con Playwright. Alfred expone además un adaptador local A2A 1.0
para descubrimiento e interoperabilidad, sin convertir los agentes internos en microservicios.

## Vista previa

| Inicio | Alfred contextual |
|---|---|
| ![Panel diario de Alfred](preview/01-inicio.png) | ![Asistente contextual de Alfred](preview/02-alfred-contextual.png) |

| Chat | Planificación |
|---|---|
| ![Chat con Alfred](preview/03-chat.png) | ![Planificación semanal](preview/04-planificacion.png) |

| Asignatura | Grupo |
|---|---|
| ![Ficha académica por asignatura](preview/05-asignatura.png) | ![Detalle de un grupo](preview/06-grupo.png) |

| Alumno | Tutoría |
|---|---|
| ![Ficha general del alumno](preview/07-alumno.png) | ![Seguimiento tutorial](preview/08-tutoria.png) |

| Organización del aula | Agentes |
|---|---|
| ![Organización del aula](preview/09-organizacion-aula.png) | ![Administración de agentes](preview/10-administracion-agentes.png) |

| Conversaciones A2A | Logs de ChatGPT |
|---|---|
| ![Trazabilidad de conversaciones A2A](preview/11-administracion-a2a.png) | ![Auditoría de peticiones a ChatGPT](preview/12-administracion-logs.png) |

| Base de datos |
|---|
| ![Administrador de base de datos](preview/13-administracion-base-datos.png) |

Las imágenes se generan con datos ficticios. Consulta también la [galería independiente](preview/README.md)
o regénérala localmente con `npm run preview:capture`.

## Requisitos

- Node.js 20.9 o posterior (probado con 22.23.3).
- npm 10 o posterior.
- Git.
- Una cuenta de ChatGPT Plus o Pro elegible si se quieren activar las funciones avanzadas de IA.
- No se necesita ChatGPT para usar las pantallas y operaciones manuales.

## Instalación en macOS

```sh
git clone https://github.com/Adrute/project-alfred.git alfred
cd alfred
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
```

En otra terminal:

```sh
npm run dev
```

Abrir `http://127.0.0.1:3000`. Para activar la IA, pulsar **Continuar con ChatGPT** y autorizar el uso
del plan. Las credenciales OAuth se conservan fuera del navegador en `data/auth`, que está excluido de Git.

## Instalación en Windows 11

En PowerShell, con Node.js y Git ya instalados:

```powershell
git clone https://github.com/Adrute/project-alfred.git alfred
Set-Location alfred
npm install
Copy-Item .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Abrir `http://127.0.0.1:3000`. No se deben copiar `node_modules` entre macOS y Windows: ejecutar
`npm install` en cada sistema. La compatibilidad está contemplada en el código, pero requiere una
ejecución real en Windows antes de declararla validada.

## Configuración

Copiar `.env.example` a `.env`. Las variables se validan al iniciar:

| Variable | Valor inicial | Propósito |
|---|---|---|
| `NEXT_TELEMETRY_DISABLED` | `1` | Desactiva telemetría de Next.js |
| `HOST` | `127.0.0.1` | Solo loopback; otros valores se rechazan |
| `PORT` | `3000` | Puerto local |
| `CHATGPT_MODEL` | `gpt-6.1-sol` | Modelo preferido cuando está disponible para la cuenta conectada |
| `DATABASE_URL` | `file:./data/alfred.db` | Archivo SQLite configurable |
| `DATA_DIRECTORY` | `./data` | Directorio local de datos |
| `LOG_LEVEL` | `info` | Nivel de registro |

El modelo efectivo se elige del catálogo disponible para la cuenta conectada. Si el modelo preferido
no está disponible, Alfred utiliza el primero que OpenAI marca como visible para esa cuenta. Sin una
sesión autorizada no existe ninguna llamada cloud: la aplicación permanece en modo manual.

Después de conectar ChatGPT, **Administración → Agentes** permite asignar un modelo distinto a Alfred,
MemoryAgent y TutoringAgent. La opción **Automático** hereda el modelo efectivo de la sesión. Los agentes
deterministas no muestran este control porque no realizan inferencias generativas.

## Comandos

```sh
npm run dev          # servidor local de desarrollo
npm run build        # compilación de producción
npm run start        # servidor local de producción
npm run lint         # análisis estático
npm run typecheck    # comprobación TypeScript
npm test             # pruebas unitarias
npm run test:e2e     # recorrido completo en Chromium
npm run agents:validate # valida roles y adaptadores del equipo de desarrollo
npm run branch:check # impide trabajar directamente en main/master o ramas sin convención
npm run ai:check      # comprueba la conexión OAuth y una salida estructurada de ChatGPT
npm run ai:eval       # evalúa la selección de herramientas con la cuenta conectada
npm run db:generate  # genera Prisma Client
npm run db:migrate   # crea/aplica una migración de desarrollo
npm run db:seed      # crea grupos, docencia, tutoría, horario y alumnado ficticio
npm run demo:prepare # añade observaciones ficticias y plano inicial idempotente
npm run preview:capture # regenera la galería de capturas con datos ficticios
npm run db:studio    # inspector local de la base
```

El endpoint `GET /api/health` informa del estado de SQLite, la conexión opcional con ChatGPT, los agentes y el enlace local.

## Equipo de desarrollo multiagente

El repositorio incluye un equipo virtual para desarrollar Alfred: Orchestrator, Architect, Backend,
Frontend, Data, QA, Security, Documentation y Reviewer. El contrato neutral vive en `.agents/`; Codex y
Claude Code disponen de adaptadores nativos en `.codex/agents/` y `.claude/agents/`. Otras herramientas
pueden aplicar exactamente el mismo protocolo leyendo `AGENTS.md` y el manifiesto.

El orquestador elige la ruta mínima según área y riesgo, limita el paralelismo y reserva los modelos más
capaces para arquitectura, seguridad y revisión. Consulta el [flujo multiagente de desarrollo](docs/development/multi-agent-workflow.md).

El desarrollo se realiza siempre en ramas de trabajo. Los agentes no pueden integrar cambios en `main`
hasta recibir una confirmación explícita del propietario para esa entrega. Antes de tocar código consultan
el [catálogo de funcionalidades](docs/features/README.md), que dirige a fichas compactas con contratos,
invariantes, archivos y pruebas relevantes. Cada entrega actualiza también el [changelog](CHANGELOG.md).

## Conversaciones y agentes

Cada conversación conserva únicamente sus propios mensajes y un estado estructurado con foco, tema y
último resultado de herramienta. Con ChatGPT conectado, Alfred envía una ventana seudonimizada de los
últimos mensajes del chat activo, por lo que una continuación como «¿y alguno más?» mantiene el tema
sin necesidad de repetirlo y sin mezclar otros chats. La memoria estructurada sigue siendo la fuente de verdad.

ChatGPT actúa como orquestador mediante llamadas tipadas a herramientas. Recibe el historial con alias,
el estado conversacional y un catálogo Zod, puede encadenar resultados y Alfred valida cada llamada antes
de consultar los servicios de alumnos, memoria, aulas, planificación o currículo. Los resultados vuelven
al modelo seudonimizados y la respuesta recupera los nombres solo en el equipo. El modelo nunca recibe
acceso directo a SQLite. Sin conexión, una ruta determinista conserva las consultas y operaciones
básicas; ninguna escritura evita el flujo de confirmación. Alfred rechaza además cualquier afirmación
de haber consultado o preparado algo cuando no exista una ejecución real que la respalde.

Las respuestas de Alfred se presentan como Markdown seguro tanto en el chat completo como en la burbuja
contextual: negritas, listas, enlaces, tablas y bloques de código se convierten en elementos React sin
inyectar HTML procedente del modelo. Los resúmenes del historial se muestran como texto limpio.

## Interoperabilidad A2A

Alfred publica una Agent Card A2A 1.0 en `GET /.well-known/agent-card.json`. La interfaz anunciada es
HTTP+JSON y solo escucha en loopback:

```text
POST /api/a2a/message:send
Content-Type: application/a2a+json
A2A-Version: 1.0
```

Las respuestas simples usan un `Message` A2A directo. Su `contextId` es el identificador de la
conversación de Alfred y permite continuar el diálogo. Si la petición crea una propuesta, la respuesta
incluye una parte de datos con el identificador de `PendingAction`; A2A no permite saltarse la
confirmación humana. En esta versión no se anuncian streaming, notificaciones push ni tareas A2A
persistentes. El adaptador es una frontera de interoperabilidad; los siete agentes continúan como
módulos locales y sus capacidades aparecen como skills de Alfred.

Dentro del proceso, Alfred delega cada herramienta especializada mediante el mismo modelo de datos
A2A 1.0: `Message`, `Task`, estado terminal y `Artifact`. Es un binding local síncrono, sin llamadas de
red entre módulos. Las solicitudes y respuestas se guardan en `AgentConversation` y `AgentMessage` y
pueden revisarse en **Administración → Conversaciones A2A**. Solo se persisten argumentos estructurados,
respuestas finales y metadatos de enrutado; nunca prompts del sistema ni razonamiento interno.

En la arquitectura actual los agentes son módulos internos del proceso de Alfred, no procesos del sistema operativo.
Los controles de Administración habilitan o bloquean de forma persistente la ejecución de cada módulo;
reiniciar restablece su estado operativo y registra el reinicio. Las estadísticas proceden de
`AgentExecution` y no contienen razonamientos internos.

## Trasladar la base de demostración

1. Detener Alfred en el equipo de origen.
2. Copiar `data/alfred.db` por un medio autorizado al directorio `data` del destino.
3. No versionar ni enviar la base mediante el repositorio.
4. Ejecutar `npm run db:deploy` en el destino antes de arrancar.

Esta versión solo puede utilizar datos ficticios. Una base con datos reales requiere una política y un
canal de transferencia aprobados por el centro.

## Privacidad y seguridad

- La aplicación escucha en `127.0.0.1` por los scripts incluidos.
- La interfaz y los datos permanecen en loopback; las únicas URLs externas están fijadas en código a
  los endpoints oficiales de autenticación y Responses de OpenAI.
- No se incluyen telemetría, CDNs ni analítica. La única salida cloud autorizada es OpenAI cuando la
  profesora conecta explícitamente su cuenta de ChatGPT.
- Los nombres del alumnado, identificadores internos, correos y teléfonos se sustituyen localmente.
  Los alias son distintos por conversación y no coinciden con las claves de SQLite.
- Las credenciales OAuth nunca se entregan al navegador, se excluyen de Git y se guardan con permisos
  de propietario cuando el sistema operativo lo permite.
- Las peticiones de Responses API usan streaming y `store: false`.
- Cada petición cloud se registra primero en SQLite y puede inspeccionarse en **Administración → Logs**.
  El registro contiene el cuerpo seudonimizado realmente enviado, la respuesta observable previa a la
  recuperación local de nombres, IDs de soporte, uso y duración; nunca cabeceras OAuth ni razonamiento interno.
- El LLM nunca recibe acceso SQL: propone operaciones tipadas, que deben confirmarse y ejecutarse
  mediante servicios de dominio.
- SQLite no cifra el archivo. Usar FileVault en macOS o BitLocker en Windows.

La guía reproducible de comprobación offline está en [docs/security/offline-verification.md](docs/security/offline-verification.md).

## Documentación

- [Changelog](CHANGELOG.md)
- [Catálogo de funcionalidades](docs/features/README.md)
- [Arquitectura](docs/architecture/overview.md)
- [Modelo del planificador](docs/architecture/planning-model.md)
- [Decisiones técnicas](docs/architecture/decisions.md)
- [Plan incremental](docs/development/plan.md)
- [Auditoría del entorno](docs/development/environment-audit.md)
- [Seguridad y verificación offline](docs/security/offline-verification.md)
- [Guion de demostración](docs/development/demo.md)
- [Equipo multiagente de desarrollo](docs/development/multi-agent-workflow.md)

## Limitaciones actuales

- La compatibilidad arquitectónica con Windows está implementada, pero todavía requiere una ejecución
  real en Windows 11 para considerarse validada.
- Las funciones avanzadas de lenguaje natural requieren iniciar sesión con una cuenta de ChatGPT elegible;
  sin ella Alfred conserva el modo manual y las reglas deterministas.
- El solver usa búsqueda heurística reproducible con 2.000 intentos; garantiza restricciones duras en
  el resultado, pero no demuestra óptimo global para aulas mayores o restricciones futuras.
- La evaluación de intención debe pasar completa con el modelo configurado antes de una entrega.
- `npm audit` no detecta vulnerabilidades de producción; existe un aviso en herramientas de lint por
  una dependencia transitiva (`braces`) sin corrección no disruptiva. Se revisará al actualizar
  `eslint-config-next`; no se usa durante la ejecución de la aplicación.
