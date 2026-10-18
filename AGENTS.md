# Instrucciones de desarrollo de Alfred

## Alcance y principios

Alfred es local-first. No añadas APIs de IA cloud, telemetría, analítica, CDNs, almacenamiento remoto
ni sincronización automática. Trabaja solo con datos ficticios hasta que exista autorización formal.
Mantén compatibilidad con macOS arm64 y Windows 11; usa Node.js y `node:path` en vez de rutas o scripts
dependientes de Unix.

## Arquitectura obligatoria

- `src/app`: interfaz y Route Handlers. No contiene reglas de dominio.
- `src/agents`: contratos, registro, orquestación y adaptadores de los siete agentes.
- `src/ai`: abstracciones de IA y `OllamaProvider`. Toda URL debe permanecer en loopback.
- `src/domain`: entidades, esquemas Zod y reglas puras.
- `src/services`: casos de uso y límites transaccionales.
- `src/repositories`: acceso persistente detrás de interfaces de dominio.
- `src/lib`: infraestructura compartida y Prisma.
- `prisma`: esquema, migraciones y seed exclusivamente ficticio.

La memoria estructurada es la fuente de verdad; los mensajes no sustituyen tablas de dominio. Los
agentes no acceden a tablas ajenas: llaman a servicios del dominio propietario.

## Mutaciones y seguridad

El LLM nunca construye ni ejecuta SQL, comandos o rutas. Solo produce propuestas estructuradas,
validadas con Zod. Toda escritura iniciada desde lenguaje natural debe:

1. resolver identificadores contra registros existentes;
2. persistir una `PendingAction` con clave de idempotencia;
3. mostrar exactamente el cambio propuesto;
4. esperar confirmación explícita;
5. ejecutar en una transacción y marcarla una sola vez.

Pregunta ante alumnos ambiguos. No inventes identificadores, diagnósticos, relaciones ni hechos.
Separa en la interfaz hechos registrados, opiniones de la profesora y propuestas de IA. No registres
prompts completos, razonamiento interno ni datos personales en logs técnicos.

## Convenciones

- TypeScript estricto; validación Zod en cada frontera no confiable.
- Código y nombres técnicos en inglés; interfaz y documentación de usuario en español.
- Módulos pequeños, importaciones mediante `@/` y APIs multiplataforma.
- Operaciones deterministas para búsquedas, fechas, estadísticas, validación y asientos.
- El servidor debe enlazar `127.0.0.1`. Nunca cambies a `0.0.0.0` por comodidad.
- No añadas dependencias o frameworks de agentes sin una decisión documentada.
- Actualiza `.env.example`, README y documentación cuando cambie configuración o arquitectura.

## Persistencia

Modifica `prisma/schema.prisma`, crea una migración con nombre descriptivo, revisa el SQL generado y
regenera el cliente. Añade claves foráneas, índices y restricciones. Nunca confirmes `.env`, archivos
`*.db` ni el cliente generado. Conserva el historial; una nueva observación no borra una anterior.

## Pruebas y definición de terminado

Ejecuta antes de entregar: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`. Para
cambios de persistencia ejecuta también las migraciones y el seed sobre una base de prueba. Toda regla
determinista debe tener pruebas unitarias; los casos de uso, integración; los recorridos críticos,
Playwright. Añade regresiones para cada fallo corregido.

No marques una función como terminada si depende de Ollama y no fue probada con el modelo configurado.
La compatibilidad Windows solo puede marcarse validada después de ejecutarla realmente en Windows.

## Añadir un agente

1. Define capacidades, esquemas de entrada/salida y si mutan datos en `src/agents`.
2. Regístralo sin acoplar el orquestador a su implementación concreta.
3. Implementa sus casos de uso en servicios y respeta la propiedad de datos.
4. Añade trazabilidad con `AgentExecution`, sin razonamientos internos.
5. Prueba descubrimiento, validación, errores y confirmaciones.
6. Documenta responsabilidades y flujo. No crees microservicios en esta POC.

## Catálogo de agentes

- `Alfred`: orquesta intenciones y confirmaciones.
- `StudentAgent`: alumnos, observaciones y relaciones contextuales.
- `TutoringAgent`: preparación y seguimiento de tutorías.
- `ClassroomAgent`: distribución de asientos y restricciones.
- `MemoryAgent`: recuperación de memoria estructurada.
- `PlanningAgent`: horarios recurrentes, sesiones concretas, excepciones y reprogramaciones.
- `CurriculumAgent`: asignaturas, unidades, contenidos y progreso confirmado.

PlanningAgent y CurriculumAgent comparten información exclusivamente mediante servicios de dominio;
no acceden directamente a tablas propiedad del otro agente.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
