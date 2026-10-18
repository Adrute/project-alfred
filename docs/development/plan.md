# Plan de desarrollo incremental

## Fase 1 · Fundación — implementada

- Next.js 16, React 19, TypeScript, Tailwind 4 y ESLint.
- Prisma 7 + SQLite, esquema, migración y seed ficticio.
- Configuración validada y enlace exclusivo a loopback.
- `LLMProvider`, `OllamaProvider`, contratos y registro inicial de agentes.
- Panel de estado, endpoint de salud, pruebas y documentación.

Puerta de salida: lint, tipos, pruebas, build, migración, seed y arranque verificados.

## Fase 2 · Chat y orquestación — implementada

Persistir conversaciones y mensajes; implementar intención estructurada, estados visibles, errores de
Ollama y confirmaciones. Comparar `qwen3:4b` con `qwen3:8b` y documentar latencia/calidad. No simular respuestas
salvo modo demo explícito y rotulado.

## Fase 3 · Alumnos y memoria — implementada

CRUD de grupos/alumnos, resolución desambiguada, propuestas de observación, confirmación idempotente,
histórico y recuperación entre reinicios. Completar el escenario de 2.º ESO C.

## Fase 4 · Tutorías — implementada

Preparación basada solo en hechos persistidos, distinción visual de hechos/propuestas, edición,
sesiones, acuerdos y seguimiento. Añadir pruebas de no invención.

## Fase 5 · Organización del aula — implementada

Definir formalmente adyacencia y distancias; implementar solver puro con restricciones duras y
preferencias ponderadas; explicar conflictos; interfaz 5×5 editable y persistencia.

## Fase 6 · Base funcional verificable — implementada en macOS

Playwright cubre el recorrido crítico, la privacidad tiene pruebas automáticas, Ollama se verificó con
JSON estructurado y existe un guion de demostración. Pendiente únicamente la ejecución real en Windows
11 y una captura formal de tráfico offline en ese sistema.

## Fase 7 · Planificador docente — fase funcional 1 implementada

- Modelo de asignaturas, asignaciones, unidades, contenidos, horario, sesiones, actividades y cambios.
- PlanningAgent y CurriculumAgent registrados en el orquestador existente.
- Generación semanal idempotente, detección de solapamientos y validación de duraciones.
- Organizador semanal responsive con detalle, estados y editor de franjas.
- Consulta de próximas clases y propuesta semanal conversacional con confirmación.
- Creación en bloque de alumnos desde clase o listado general.
- Creación confirmable de clases, asignaturas y horario recurrente desde lenguaje natural.
- Delegaciones A2A 1.0 internas auditables desde Administración.

Siguientes incrementos: seguimiento detallado de ejecución, reprogramación asistida, excepciones desde
la interfaz y edición completa de unidades/contenidos.

## Roadmap posterior

Adaptaciones educativas, evaluaciones, tareas, informes, importación/exportación, escritorio e
integraciones autorizadas.
