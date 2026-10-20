# Alumnado y grupos

## Alcance

Grupos docentes, alumnado, matrículas, altas individuales o masivas, perfil general, observaciones y
resolución inequívoca de referencias a estudiantes.

## Flujo actual

Las pantallas consumen `/api/classrooms` y `/api/students`. Las altas masivas se analizan y validan antes
de crear una propuesta; el servicio resuelve el grupo y evita duplicados. Desde una clase se puede abrir
la ficha del alumno. Una misma persona puede estar matriculada en una asignatura y pertenecer además al
grupo tutor, sin mezclar ambos seguimientos.

## Fuente de verdad e invariantes

- `Student` representa a la persona y `StudentEnrollment` su pertenencia a un `Classroom`.
- `StudentObservation` conserva historial; una observación nueva nunca reemplaza otra.
- Ante coincidencias ambiguas se pregunta, no se inventa ni se elige silenciosamente.
- Toda alta o edición por lenguaje natural pasa por `PendingAction` y confirmación.

## Puntos de entrada

- API: `src/app/api/students/route.ts`, `src/app/api/classrooms/route.ts`,
  `src/app/api/classrooms/[id]/students/route.ts`, `src/app/api/observations/[id]/route.ts`
- Servicios: `src/services/student-service.ts`, `src/services/classroom-service.ts`
- Dominio: `src/domain/student-admin.ts`, `src/domain/natural-language.ts`
- Persistencia: modelos `Student`, `StudentEnrollment`, `StudentObservation` y `Classroom` en
  `prisma/schema.prisma`
- Pruebas: `tests/domain/natural-language.test.ts`, `tests/domain/student-context.test.ts`,
  `tests/integration/observation-flow.test.ts`

## Checklist de cambio

- Verificar duplicados, grupo inexistente, alumno ambiguo y lote parcialmente inválido.
- Mantener enlaces clase → alumno y separar ficha general, académica y tutorial.
- Si se exponen datos a IA cloud, cargar también `cloud-ai-privacy-logs.md`.
