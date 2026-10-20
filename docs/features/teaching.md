# Asignaturas y seguimiento académico

## Alcance

Portafolio de asignaturas impartidas, combinación asignatura-grupo, ficha académica por alumno,
calificaciones ponderadas, progreso, participación, tareas, notas y apoyos.

## Flujo actual

`teaching-view.tsx` carga el portafolio desde `/api/teaching`, abre la asignación docente elegida y guarda
los datos propios de esa asignatura mediante `/api/teaching/records`. Las calificaciones se agregan sin
modificar la ficha general ni el seguimiento de tutoría.

## Fuente de verdad e invariantes

- `TeachingAssignment` une `Subject` y `Classroom` por curso académico.
- `StudentSubjectRecord` pertenece a alumno y asignación; `AssessmentGrade` aporta evidencias evaluables.
- `weightedGradeAverage` es determinista y debe conservar pruebas unitarias.
- Ser tutorando y recibir una asignatura son relaciones independientes.

## Puntos de entrada

- UI: `src/components/teaching-view.tsx`
- API: `src/app/api/teaching/route.ts`, `src/app/api/teaching/records/route.ts`
- Servicio: `src/services/teaching-service.ts`
- Dominio: `src/domain/teaching.ts`
- Persistencia: `Subject`, `TeachingAssignment`, `StudentSubjectRecord`, `AssessmentGrade`
- Pruebas: `tests/domain/teaching.test.ts`, `tests/e2e/demo.spec.ts`

## Checklist de cambio

- Validar pertenencia del alumno a la clase y propiedad de la asignación.
- Recalcular calificaciones de forma determinista y documentar cambios de ponderación.
- No trasladar automáticamente notas académicas a observaciones tutoriales.
