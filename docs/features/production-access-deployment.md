# Acceso local, PWA y despliegue privado

## Alcance

Cuentas locales, roles de aplicación, sesiones de navegador, controles de origen/CSRF, PWA instalable y
contenedorización de una instancia de Alfred con SQLite persistente.

## Flujo actual

No existe registro web. Un operador con acceso al proceso crea, actualiza, lista o desactiva cuentas con
`npm run auth:user`. `AppUser` conserva nombre de usuario, nombre visible, hash de contraseña y rol;
`AppSession` conserva solo el hash del token de sesión, su vencimiento y revocación. Los roles son
`admin` y `user`. La sesión dura 12 horas, la cookie es HttpOnly y las mutaciones de API comprueban el
origen esperado y un token CSRF.

Ambos roles acceden al mismo espacio docente y a las mismas conversaciones. El rol `admin` habilita el
panel y las rutas administrativas. Esta versión no implementa propiedad de registros ni aislamiento por
cuenta.

Compose empaqueta un proceso web, habilita ChatGPT por defecto y monta el directorio completo en `/app/data`.
El arranque aplica migraciones Prisma pendientes antes de abrir Next.js y no ejecuta seed. El puerto
publicado del host se limita a loopback, pensado para Tailscale Serve. La aplicación expone manifiesto
standalone y genera el icono de inicio de iPhone con el logo de Alfred sobre fondo opaco. No añade
service worker ni caché offline de datos sensibles.

## Fuente de verdad e invariantes

- `AppUser` y `AppSession` son tablas de acceso, separadas de los registros docentes.
- Contraseñas nunca se aceptan en argumentos de CLI; se leen por TTY o stdin.
- El CLI no ofrece alta pública; cambiar contraseña/rol o desactivar una cuenta revoca sesiones.
- `/api/health` es mínimo y no requiere sesión; las demás rutas docentes requieren sesión.
- Los clientes validan el token CSRF en cada mutación autenticada. No se confía en cabeceras de identidad
  aportadas por Tailscale ni en `Host` para decidir el origen admitido.
- Las dos cuentas comparten los datos almacenados; autenticación no equivale a separación de tenant.
- El archivo SQLite no se cifra por Alfred. El volumen y sus backups requieren protección del host.
- En el contenedor `HOST=0.0.0.0` es solo el bind interno; Compose publica `127.0.0.1:<puerto>:3000`.
- Alfred requiere un hostname HTTPS dedicado frente a otras aplicaciones: los puertos no aíslan cookies.
- Nunca ejecutar varias instancias contra el mismo volumen SQLite.
- La PWA es instalable; offline y service worker no están implementados.

## Puntos de entrada

- Dominio y persistencia: `src/domain/auth.ts`, `src/services/auth-service.ts`,
  `src/repositories/auth-repository.ts`, `prisma/schema.prisma`, `prisma/migrations/20261024120000_app_auth/`
- Frontera HTTP y UI: `src/lib/api-security.ts`, `src/lib/client-api.ts`,
  `src/app/api/auth/session/route.ts`, `src/app/login/`, `src/app/manifest.ts`, `src/app/apple-icon.tsx`, `src/app/layout.tsx`
- Administración de cuentas: `scripts/manage-users.ts`, comando `npm run auth:user`
- Contenedor: `Dockerfile`, `.dockerignore`, `compose.yaml`, `scripts/start-production.ts`
- Guía operativa: `DEPLOYMENT.md`
- Pruebas: `tests/integration/app-auth.test.ts`, `tests/integration/app-auth-migration.test.ts`,
  `tests/security/`, `tests/e2e/mobile.spec.ts`

## Configuración

- `APP_ORIGIN`: origen exacto HTTPS de producción; local usa `http://127.0.0.1:<PORT>`.
- `CLOUD_AI_ENABLED`: `true` en Compose; `false` es el corte de emergencia de toda comunicación cloud.
- `CHATGPT_OAUTH_CLIENT_ID`: ID del cliente OAuth público registrado para el callback HTTPS.
- `HOST`: loopback local; `0.0.0.0` solo dentro del contenedor.
- `DATABASE_URL` y `DATA_DIRECTORY`: Compose los fija bajo `/app/data`.
- `ALFRED_HOST_PORT`: puerto local opcional del host, por defecto `13000`.
- `ALFRED_DATA_VOLUME`: nombre del volumen Docker, por defecto `alfred-production-data`; una restauración
  segura usa un volumen nuevo y cambia esta variable solo con Alfred detenido.

## Verificación y límites

La prueba Playwright de interfaz móvil usa Chromium y datos ficticios. No certifica Safari ni una
instalación real en iPhone. La prueba de migración debe preservar tablas existentes y no aplicar seeds.
El flujo ChatGPT en HTTPS requiere un cliente OAuth público registrado por OpenAI para el callback
exacto de la instancia. La sesión se autoriza desde el botón y vuelve a la misma instancia.

## Checklist de cambio

- Exigir revisión de security para autenticación, sesiones, roles, CSRF, cabeceras o integraciones cloud.
- Probar migraciones y restauración sobre una base temporal; nunca abrir ni reemplazar la base local actual.
- Construir la imagen, comprobar usuario no privilegiado, healthcheck, volumen y binding loopback.
- Ejecutar lint, typecheck, pruebas unitarias, build y recorridos Playwright de escritorio y móvil.
- Mantener `DEPLOYMENT.md`, `.env.example`, README, changelog y esta ficha sincronizados.
