# Organización del aula

## Alcance

Generación determinista de distribuciones de asientos, restricciones duras, preferencias blandas,
visualización del plano e intercambio manual de posiciones.

## Flujo actual

`classroom-service.ts` obtiene alumnado y restricciones del grupo, ejecuta el solver puro y persiste un
`SeatingLayout` con sus asignaciones. Los intercambios manuales usan la ruta de swap y validan el plano.

## Fuente de verdad e invariantes

- `SeatingLayout` y `SeatingAssignment` guardan cada distribución.
- `generateSeating` y `validateSeatingAssignments` son deterministas para la misma semilla y entrada.
- Nunca se usa esta funcionalidad para responder sobre alergias, excursiones u observaciones alimentarias.
- Las restricciones duras deben cumplirse; las preferencias solo influyen en la puntuación.

## Puntos de entrada

- API: `src/app/api/layouts/[id]/swap/route.ts`, `src/app/api/classrooms/route.ts`
- Servicio: `src/services/classroom-service.ts`
- Dominio: `src/domain/seating.ts`
- Persistencia: `SeatingLayout`, `SeatingAssignment`, `StudentRelationship`
- Pruebas: `tests/domain/seating.test.ts`, `tests/e2e/demo.spec.ts`

## Checklist de cambio

- Probar capacidad insuficiente, restricciones incompatibles y swaps.
- Mantener una salida reproducible y explicar si no existe solución válida.
- Cargar `students-classrooms.md` si cambian relaciones u observaciones.
