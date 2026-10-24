# Administración de datos

## Alcance

Exploración administrativa de SQLite, recuentos, registros, borrado individual o por ámbito, esquema
Prisma, migraciones y seed ficticio.

## Flujo actual

La interfaz administrativa consulta el catálogo permitido mediante `/api/admin/database`. Los borrados
usan rutas específicas, una frase de confirmación exacta y servicios transaccionales. El repositorio
expone operaciones enumeradas; nunca acepta nombres de tabla o SQL producidos por un modelo.

## Fuente de verdad e invariantes

- `prisma/schema.prisma` es el esquema; las migraciones conservan su historial.
- `databaseTableCatalog` es la lista cerrada de tablas navegables.
- Los borrados requieren confirmación reforzada y respetan relaciones y transacciones.
- `.env`, `*.db` y el cliente generado no se versionan.
- Seed y pruebas utilizan solo datos ficticios.
- Las tablas `AppUser` y `AppSession` son infraestructura de acceso y no forman parte del catálogo de
  exploración, exportación o borrado masivo del administrador de base de datos.
- El despliegue Compose monta el directorio completo `/app/data`; backup/restauración requieren detener
  el proceso para obtener una copia coherente. Consulta [DEPLOYMENT.md](../../DEPLOYMENT.md).

## Puntos de entrada

- UI: `src/components/admin-view.tsx`
- API: `src/app/api/admin/database/route.ts`, `src/app/api/admin/database/[table]/[id]/route.ts`,
  `src/app/api/admin/database/clear/route.ts`
- Servicio y repositorio: `src/services/database-admin-service.ts`,
  `src/repositories/database-admin-repository.ts`
- Dominio: `src/domain/database-admin.ts`
- Persistencia: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`

## Checklist de cambio

- Data y security son obligatorios para esquema o borrado.
- Crear migración descriptiva, revisar SQL, regenerar Prisma Client y probar migrate + seed en base temporal.
- Probar confirmación incorrecta, clave inexistente, restricciones y atomicidad.
- Actualizar la ficha funcional propietaria de cualquier entidad modificada.
