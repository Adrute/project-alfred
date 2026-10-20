# Tutoría y seguimiento tutorial

## Alcance

Grupo tutor propio, tutorandos, preparación de sesiones, reuniones familiares, acuerdos y seguimiento
general independiente de las asignaturas impartidas.

## Flujo actual

`tutor-group-view.tsx` obtiene el espacio tutorial desde `/api/tutor-group`. En cada tutorando se puede
copiar un comentario de otro docente conservando autor, contexto, fecha y texto original. Alfred propone
una versión para la familia, que permanece separada y editable hasta que la profesora la confirma. En ese
momento se vincula a la siguiente sesión futura o a un borrador de próxima tutoría. La preparación de
tutorías y los acuerdos usan rutas específicas; no convierten automáticamente calificaciones de asignatura
en hechos tutoriales.

## Fuente de verdad e invariantes

- El grupo tutor se referencia desde la configuración docente; no se deduce de las clases impartidas.
- `TutoringSession` y `TutoringAgreement` conservan el historial de cada seguimiento.
- `TeacherFeedback` conserva el comentario original, la propuesta, su procedencia y la sesión asociada.
- Una propuesta generativa no se presenta en la reunión hasta que la profesora la confirma expresamente.
- Las propuestas generativas se distinguen de hechos y opiniones registrados.
- Un alumno puede ser tutorando y estudiante de una o varias asignaturas con ámbitos separados.

## Puntos de entrada

- UI: `src/components/tutor-group-view.tsx`, `src/components/teacher-feedback-panel.tsx`,
  `src/components/alfred-app.tsx`
- API: `src/app/api/tutor-group/route.ts`, `src/app/api/tutorings/[id]/route.ts`,
  `src/app/api/tutorings/[id]/agreements/route.ts`, `src/app/api/students/[id]/teacher-feedback/route.ts`,
  `src/app/api/teacher-feedback/[id]/confirm/route.ts`
- Servicios: `src/services/tutor-group-service.ts`, `src/services/tutoring-service.ts`,
  `src/services/teacher-feedback-service.ts`
- Dominio: `src/domain/teaching.ts`, `src/domain/teacher-feedback.ts`
- Persistencia: `TutoringSession`, `TutoringAgreement`, `TeacherFeedback`, `Student`, `Classroom`
- Pruebas: `tests/domain/teacher-feedback.test.ts`, `tests/integration/observation-flow.test.ts`,
  `tests/e2e/demo.spec.ts`, `tests/privacy/student-pseudonymization.test.ts`

## Checklist de cambio

- Probar alumno tutorando, no tutorando y alumno también presente en una asignatura.
- Conservar procedencia y fecha de reuniones y acuerdos.
- Mantener siempre visible el texto original y exigir revisión antes de asociar la versión familiar.
- Cargar `cloud-ai-privacy-logs.md` si interviene IA generativa.
