# Alfred

Alfred es una plataforma local-first de asistencia docente. La aplicación combina una interfaz web en
Next.js, memoria estructurada en SQLite y siete agentes coordinados. El lenguaje natural se procesa
exclusivamente con Ollama en el propio equipo; las decisiones y escrituras se validan en código.

## Estado

La base funcional está implementada: múltiples conversaciones independientes con
historial y contexto propio, Alfred disponible como asistente flotante consciente de la pantalla,
confirmaciones idempotentes, gestión de clases y altas masivas de alumnos, observaciones editables y confirmadas,
recuperación de memoria, tutorías asistidas por Ollama, acuerdos, solver determinista de
asientos y plano 5×5 editable. La primera fase del Planificador Docente añade horarios recurrentes,
asignaturas, unidades, contenidos, sesiones idempotentes, creación de horarios completos por lenguaje
natural y un organizador semanal editable. **Mis asignaturas** separa cada combinación de asignatura y
grupo e incorpora una ficha académica por alumno con calificaciones ponderadas, progreso, participación,
tareas, notas y apoyos. **Mi tutoría** es un espacio independiente para el grupo tutor, el seguimiento
general, las reuniones familiares y sus acuerdos. El panel
de Administración muestra los siete agentes, su estado, capacidades, actividad y estadísticas;
permite controlarlos, revisar sus intercambios A2A 1.0, explorar SQLite y borrar registros o áreas con confirmación reforzada. El
recorrido crítico está automatizado con Playwright. Alfred expone además un adaptador local A2A 1.0
para descubrimiento e interoperabilidad, sin convertir los agentes internos en microservicios.

## Vista previa

![Panel diario de Alfred](preview/01-inicio.png)

Consulta la [galería completa de la aplicación](preview/README.md), con las pantallas de chat,
planificación, asignaturas, grupos, alumnado, tutoría, organización del aula y administración.

## Requisitos

- Node.js 20.9 o posterior (probado con 22.23.3).
- npm 10 o posterior.
- Git.
- Ollama para las funciones de IA. Los datos deterministas funcionan aunque Ollama esté detenido.
- Al menos 9 GB libres para el perfil recomendado `qwen3.5:9b`.

## Instalación en macOS

```sh
git clone <URL_DEL_REPOSITORIO> alfred
cd alfred
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
ollama pull qwen3.5:9b
ollama serve
```

En otra terminal:

```sh
npm run dev
```

Abrir `http://127.0.0.1:3000`. Si Ollama ya se inicia como aplicación de macOS, no es necesario
ejecutar `ollama serve` manualmente.

## Instalación en Windows 11

En PowerShell, con Node.js, Git y Ollama ya instalados:

```powershell
git clone <URL_DEL_REPOSITORIO> alfred
Set-Location alfred
npm install
Copy-Item .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
ollama pull qwen3.5:9b
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
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Debe ser una URL loopback |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Modelo local configurable |
| `OLLAMA_CONTEXT_LENGTH` | `8192` | Ventana de contexto usada por el bucle de herramientas |
| `OLLAMA_DEMO_MODE` | `false` | Reserva explícita para simulación futura |
| `DATABASE_URL` | `file:./data/alfred.db` | Archivo SQLite configurable |
| `DATA_DIRECTORY` | `./data` | Directorio local de datos |
| `LOG_LEVEL` | `info` | Nivel de registro |

El perfil recomendado `qwen3.5:9b` prioriza la calidad de razonamiento, el seguimiento de instrucciones
y la selección de herramientas manteniendo toda la inferencia en el equipo. `qwen3:4b` puede usarse
para desarrollo rápido, pero no es el perfil aceptado para validar la fiabilidad funcional. No existe
fallback a un proveedor externo.

## Comandos

```sh
npm run dev          # servidor local de desarrollo
npm run build        # compilación de producción
npm run start        # servidor local de producción
npm run lint         # análisis estático
npm run typecheck    # comprobación TypeScript
npm test             # pruebas unitarias
npm run test:e2e     # recorrido completo en Chromium
npm run ai:check      # comprueba modelo local y salida JSON estructurada
npm run ai:eval       # evalúa la selección de herramientas con casos representativos
npm run db:generate  # genera Prisma Client
npm run db:migrate   # crea/aplica una migración de desarrollo
npm run db:seed      # crea grupos, docencia, tutoría, horario y alumnado ficticio
npm run demo:prepare # añade observaciones ficticias y plano inicial idempotente
npm run preview:capture # regenera la galería de capturas con datos ficticios
npm run db:studio    # inspector local de la base
```

El endpoint `GET /api/health` informa del estado de SQLite, Ollama, los agentes y el enlace local.

## Conversaciones y agentes

Cada conversación conserva únicamente sus propios mensajes y un estado estructurado con foco, tema y
último resultado de herramienta. Alfred envía a Ollama una ventana de los últimos mensajes del chat
activo, por lo que una continuación como «¿y alguno más?» mantiene el tema sin necesidad de repetirlo
y sin mezclar otros chats. La memoria estructurada de alumnos sigue siendo la fuente de verdad.

Ollama actúa como orquestador mediante llamadas nativas a herramientas. Recibe el historial, el estado
conversacional y un catálogo Zod, puede encadenar resultados y Alfred valida cada llamada antes de
consultar los servicios de alumnos, memoria, aulas, planificación o currículo. El modelo nunca recibe
acceso directo a SQLite. Si Ollama no está disponible, una ruta determinista conserva las consultas
básicas; ninguna escritura evita el flujo de confirmación. Alfred rechaza además cualquier afirmación
de haber consultado o preparado algo cuando no exista una ejecución real que la respalde.

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
- El proveedor de IA rechaza direcciones no loopback.
- No se incluyen telemetría, CDNs, analítica ni proveedores cloud.
- El LLM nunca recibe acceso SQL: propone operaciones tipadas, que deben confirmarse y ejecutarse
  mediante servicios de dominio.
- SQLite no cifra el archivo. Usar FileVault en macOS o BitLocker en Windows.

La guía reproducible de comprobación offline está en [docs/security/offline-verification.md](docs/security/offline-verification.md).

## Documentación

- [Arquitectura](docs/architecture/overview.md)
- [Modelo del planificador](docs/architecture/planning-model.md)
- [Decisiones técnicas](docs/architecture/decisions.md)
- [Plan incremental](docs/development/plan.md)
- [Auditoría del entorno](docs/development/environment-audit.md)
- [Seguridad y verificación offline](docs/security/offline-verification.md)
- [Guion de demostración](docs/development/demo.md)

## Limitaciones actuales

- La compatibilidad arquitectónica con Windows está implementada, pero todavía requiere una ejecución
  real en Windows 11 para considerarse validada.
- La comprensión rápida de los escenarios de demo combina reglas deterministas con Ollama; solicitudes
  libres usan el modelo local y pueden tardar según el equipo.
- El solver usa búsqueda heurística reproducible con 2.000 intentos; garantiza restricciones duras en
  el resultado, pero no demuestra óptimo global para aulas mayores o restricciones futuras.
- La evaluación de intención debe pasar completa con el modelo configurado antes de una entrega.
- `npm audit` no detecta vulnerabilidades de producción; existe un aviso en herramientas de lint por
  una dependencia transitiva (`braces`) sin corrección no disruptiva. Se revisará al actualizar
  `eslint-config-next`; no se usa durante la ejecución de la aplicación.
