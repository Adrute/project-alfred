# Tutoría y seguimiento tutorial

## Alcance

Grupo tutor propio, tutorandos, preparación de sesiones, reuniones familiares, acuerdos y seguimiento
general independiente de las asignaturas impartidas.

## Flujo actual

`tutor-group-view.tsx` obtiene el espacio tutorial desde `/api/tutor-group`. La preparación de tutorías y
los acuerdos usan rutas específicas; pueden consultar memoria estructurada del alumno, pero no convierten
automáticamente calificaciones de asignatura en hechos tutoriales.

## Fuente de verdad e invariantes

- El grupo tutor se referencia desde la configuración docente; no se deduce de las clases impartidas.
- `TutoringSession` y `TutoringAgreement` conservan el historial de cada seguimiento.
- Las propuestas generativas se distinguen de hechos y opiniones registrados.
- Un alumno puede ser tutorando y estudiante de una o varias asignaturas con ámbitos separados.

## Puntos de entrada

- UI: `src/components/tutor-group-view.tsx`
- API: `src/app/api/tutor-group/route.ts`, `src/app/api/tutorings/[id]/route.ts`,
  `src/app/api/tutorings/[id]/agreements/route.ts`
- Servicios: `src/services/tutor-group-service.ts`, `src/services/tutoring-service.ts`
- Dominio compartido: `src/domain/teaching.ts`
- Persistencia: `TutoringSession`, `TutoringAgreement`, `Student`, `Classroom`
- Pruebas: `tests/e2e/demo.spec.ts`, `tests/privacy/student-pseudonymization.test.ts`

## Checklist de cambio

- Probar alumno tutorando, no tutorando y alumno también presente en una asignatura.
- Conservar procedencia y fecha de reuniones y acuerdos.
- Cargar `cloud-ai-privacy-logs.md` si interviene IA generativa.
