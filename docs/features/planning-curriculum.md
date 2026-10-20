# Planificación, horario y currículo

## Alcance

Organización profesional de la profesora: horario semanal recurrente, clases y otras actividades,
excepciones, sesiones concretas, unidades, contenidos, actividades y progreso curricular confirmado.

## Flujo actual

`planning-view.tsx` combina horario y currículo. `planning-service.ts` valida solapes, genera sesiones
idempotentes para una semana y enlaza cada clase con su asignación docente. Las rutas de currículo y
lección actualizan planes concretos sin convertir el calendario en seguimiento tutorial.

## Fuente de verdad e invariantes

- `WeeklyTimetable` y `TimetableSlot` representan recurrencia; `LessonPlan` una sesión fechada.
- `TeachingUnit` y `LearningContent` describen currículo; el progreso solo cambia tras confirmación.
- Horario docente y tutoría son ámbitos relacionados, pero diferentes.
- Fechas y solapes usan reglas deterministas de `src/domain/planning.ts`.

## Puntos de entrada

- UI: `src/components/planning-view.tsx`
- API: `src/app/api/planning/route.ts`, `src/app/api/planning/timetable/route.ts`,
  `src/app/api/planning/timetable/[id]/route.ts`, `src/app/api/planning/lessons/[id]/route.ts`,
  `src/app/api/planning/curriculum/route.ts`
- Servicio: `src/services/planning-service.ts`
- Dominio: `src/domain/planning.ts`, `src/domain/natural-language.ts`
- Arquitectura: `docs/architecture/planning-model.md`
- Pruebas: `tests/domain/planning.test.ts`, `tests/domain/natural-language.test.ts`, `tests/e2e/demo.spec.ts`

## Checklist de cambio

- Probar solapes, duración, recurrencia, idempotencia y límites de semana.
- Mantener la distinción entre asignación docente, sesión, contenido y actividad no lectiva.
- Actualizar `docs/architecture/planning-model.md` si cambia el modelo temporal.
