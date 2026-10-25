# Despliegue privado de Alfred en Coolify

Esta guía describe el despliegue de una instancia única de Alfred en Docker Compose. El contenedor
escucha en el bridge Docker y publica el puerto del host solo en `127.0.0.1`; el acceso de usuario se
realiza mediante Tailscale Serve y HTTPS privado. No se configura dominio público ni proxy público.

## Requisitos y decisiones

- Ubuntu Server 24.04, Docker Engine y Coolify ya instalados.
- Repositorio privado de GitHub autorizado en Coolify.
- Un servicio `alfred`, una réplica y un volumen Docker `alfred-data` montado en `/app/data`.
- SQLite permanece en `/app/data/alfred.db`; el resto del directorio también contiene datos runtime,
  incluida la carpeta `auth` si se habilitase una integración revisada.
- No ejecutar `db:seed` en producción. La imagen migra el esquema al arrancar y no crea datos ficticios.
- No compartir el volumen entre despliegues simultáneos ni ejecutar dos instancias contra SQLite.
- ChatGPT es el único proveedor generativo. Compose lo habilita por defecto y conserva
  `CLOUD_AI_ENABLED=false` como corte de emergencia.

## Preparar la fuente GitHub

1. En Coolify, autoriza el acceso al repositorio privado de Alfred con la integración GitHub disponible
   en tu instalación. Limita el permiso al repositorio necesario.
2. Crea un recurso de tipo aplicación Docker Compose y selecciona el repositorio, la rama de producción
   acordada y la ruta `compose.yaml` desde la raíz del proyecto.
3. Conserva el build desde `Dockerfile`. No selecciones detección automática de Next.js ni un Dockerfile
   alternativo.
4. Configura una sola instancia y desactiva cualquier estrategia de despliegue que arranque una segunda
   réplica mientras la primera mantiene el volumen SQLite.
5. No asignes dominio al proxy público de Coolify, no conectes Alfred a la red predefinida del proxy y
   no habilites publicación pública. El Compose crea una red bridge privada del proyecto.
6. Mantén el volumen lógico `alfred-data` asociado al servicio en `/app/data`. Compose usa por defecto el
   nombre Docker `alfred-production-data`; anota el valor efectivo de `ALFRED_DATA_VOLUME`, que se
   necesitará para backup y restauración.

## Variables de Coolify

Define `APP_ORIGIN` en las variables de entorno y también como argumento de build requerido por Compose.
Debe coincidir exactamente con el origen HTTPS que usará el iPhone y los demás clientes, sin barra final
ni ruta. Por ejemplo, el valor tendrá la forma:

```text
https://<nombre>.<tailnet>.ts.net
```

No pegues aquí un secreto: `APP_ORIGIN` es una URL pública dentro de tu tailnet, no una credencial.

Variables opcionales:

| Variable | Valor predeterminado | Uso |
|---|---|---|
| `ALFRED_HOST_PORT` | `13000` | Puerto local del host; Compose lo publica como `127.0.0.1:<puerto>:3000`. |
| `ALFRED_DATA_VOLUME` | `alfred-production-data` | Nombre Docker del volumen persistente; no cambiar durante una operación normal. |
| `LOG_LEVEL` | `info` | Nivel de logs técnicos. |
| `CLOUD_AI_ENABLED` | `true` | Habilita ChatGPT; usar `false` para cortar inmediatamente la salida cloud. |
| `CHATGPT_MODEL` | `gpt-6.1-sol` | Preferencia sujeta al catálogo de la cuenta conectada. |
| `CHATGPT_OAUTH_CLIENT_ID` | vacío | Cliente OAuth público registrado por OpenAI para `<APP_ORIGIN>/auth/callback`. |

El Compose determina `DATABASE_URL=file:/app/data/alfred.db`, `DATA_DIRECTORY=/app/data`,
`HOST=0.0.0.0` y `PORT=3000`. No reemplaces esos valores desde Coolify.
No se requieren secretos para iniciar Alfred; las contraseñas se crean localmente después del primer
arranque. El ID de cliente OAuth no es un secreto. No introduzcas tokens de Tailscale ni OAuth como
variables de la aplicación.

## Primer arranque

1. Inicia el despliegue desde Coolify. El comando de inicio aplica migraciones pendientes antes de abrir
   el servidor. El proceso termina sin iniciar Alfred si una migración falla. No ejecuta seed.
2. Espera a que Coolify marque el healthcheck saludable. La ruta `GET /api/health` devuelve únicamente
   disponibilidad (`ok` o `unavailable`) y no requiere autenticación.
3. En la terminal del contenedor abierta desde Coolify, crea el administrador inicial:

   ```sh
   npm run auth:user -- create profesora admin "Profesora"
   ```

   La contraseña se pide de forma interactiva y no se muestra. No la escribas como argumento de shell,
   variable de entorno, ticket ni log. Para añadir la segunda cuenta usa el mismo comando con rol `user`
   o `admin` según corresponda. No existe alta web.
4. Accede a Alfred solo por la dirección tailnet. `admin` puede usar el panel administrativo; `user`
   no puede. Las cuentas comparten el mismo conjunto de datos docentes y conversaciones; actualmente no
   existe separación por docente o por cuenta.

Las sesiones duran 12 horas. Las operaciones que modifican datos requieren origen exacto y token CSRF.
Desactivar una cuenta o cambiar su contraseña/rol revoca sus sesiones previas. Para administrar cuentas
posteriormente usa `npm run auth:user -- list`, `update` o `disable` desde la terminal de Coolify.

## Tailscale Serve

Configura Tailscale Serve en el host Ubuntu para reenviar el HTTPS privado de la máquina a
`http://127.0.0.1:13000` (o al puerto elegido con `ALFRED_HOST_PORT`):

```bash
sudo tailscale serve --bg http://127.0.0.1:13000
tailscale serve status
```

`--bg` conserva la configuración de Serve después de que termine el comando y tras reinicios de
Tailscale. No uses `tailscale funnel` ni habilites exposición pública. Comprueba que la URL HTTPS que
muestre `tailscale serve status` coincide carácter por carácter con `APP_ORIGIN`. Si la versión instalada
no acepta esta sintaxis, detente y contrasta `tailscale serve --help` con la documentación oficial antes
de cambiar la red o publicar otro puerto.

No uses `network_mode: host`. El proceso escucha en `0.0.0.0` dentro de Docker, mientras el binding del
host queda fijado a loopback. Las demás aplicaciones de la VPS permanecen en sus recursos y volúmenes
independientes.

Reserva un hostname HTTPS dedicado para Alfred cuando añadas otras aplicaciones. Las cookies web se
separan por hostname y ruta, no por puerto: dos aplicaciones servidas con el mismo nombre Tailscale en
puertos distintos pueden recibir la misma cookie host-only. No publiques una aplicación ajena o menos
confiable bajo el hostname de Alfred. Si la configuración de Tailscale disponible no permite identidades o
hostnames separados, considera esas aplicaciones parte del mismo perímetro de confianza y no las mezcles
hasta diseñar el aislamiento.

## Copia de seguridad y restauración

Una copia debe contener el directorio completo `/app/data`, no solo `alfred.db`. Para garantizar una copia
SQLite coherente, detén el servicio desde Coolify antes de copiarlo; así no quedan escrituras ni una WAL
activa durante el backup. Registra el nombre configurado en `ALFRED_DATA_VOLUME` y verifica el origen con
`docker volume inspect <nombre-real-del-volumen>`.

Ejemplo de copia en el host, usando una ruta de backup ya creada y protegida:

```sh
docker run --rm \
  -v <nombre-real-del-volumen>:/source:ro \
  -v /ruta/privada/backup:/backup \
  alpine:3.22 \
  tar -czf /backup/alfred-data-2026-10-24T120000Z.tar.gz -C /source .
```

Usa un nombre único con la fecha y hora UTC reales en vez del ejemplo para no reemplazar una copia previa.

La imagen auxiliar se usa únicamente para archivar el volumen y no constituye un segundo servicio de
Alfred. Copia el archivo resultante fuera de la VPS mediante un canal personal aprobado, cifra el medio
si corresponde y verifica que el archivo se puede listar con `tar -tzf`. No guardes backups en GitHub,
en el volumen de Alfred ni en un directorio servido públicamente.

Para restaurar, detén Alfred y conserva primero una copia del estado actual. No extraigas un snapshot
encima del volumen existente: podrían sobrevivir archivos creados después del backup y mezclarse con el
estado restaurado. Crea un volumen nuevo y vacío con un nombre único:

```sh
docker volume create alfred-restore-20261024T120000Z
```

Sustituye ese nombre y el archivo del ejemplo por los valores reales. El comando siguiente extrae el
directorio en el volumen nuevo y fija UID/GID `1000:1000`, que es el usuario del contenedor:

```sh
docker run --rm \
  -v alfred-restore-20261024T120000Z:/target \
  -v /ruta/privada/backup:/backup:ro \
  alpine:3.22 \
  sh -c 'tar -xzf /backup/alfred-data-2026-10-24T120000Z.tar.gz -C /target && chown -R 1000:1000 /target'
```

Comprueba que el archivo esperado existe dentro del volumen restaurado. Cambia `ALFRED_DATA_VOLUME` en
Coolify al nombre del volumen nuevo y despliega el mismo commit de aplicación. El arranque ejecutará
`db:deploy`; después comprueba `GET /api/health`, el acceso y los datos esperados. Si falla, detén el
servicio y devuelve `ALFRED_DATA_VOLUME` al nombre anterior. No borres ninguno de los dos volúmenes hasta
terminar la validación.

## Rollback

Antes de cada actualización, toma y verifica una copia completa del volumen. Nunca ejecutes dos versiones
contra el mismo SQLite a la vez. Si el cambio de esquema fue backward-compatible, vuelve al commit o
imagen anterior con el mismo volumen y verifica health y una lectura funcional. Si la migración no es
compatible hacia atrás, detén el servicio y restaura el snapshot completo previo a la actualización;
después vuelve al commit anterior y verifica la instancia. No improvises SQL inverso ni elimines filas de
`_prisma_migrations`.

## Migración futura desde el entorno local

La transferencia de bases reales no forma parte de esta preparación y no se ha ejecutado. Cuando exista
autorización para trasladar datos:

1. Detén Alfred en el origen y genera una copia SQLite coherente del directorio completo de datos.
2. Verifica la integridad de la copia y registra el commit y la versión de esquema del origen.
3. Transfiere el archivo fuera de Git mediante un canal aprobado y protegido; no lo adjuntes a incidencias
   ni lo copies a la imagen Docker.
4. Restaura primero en una instancia staging aislada con su propio volumen y ejecuta migraciones.
5. Comprueba health, cuentas, recuentos y recorridos acordados con datos autorizados.
6. Programa el corte, detén el origen, realiza un backup final, restaura el snapshot validado en el volumen
   de producción y verifica el servicio antes de permitir el uso diario.

Esta rama no ha copiado ni migrado datos reales a la VPS.

## PWA y acceso desde iPhone

Alfred entrega manifiesto standalone e iconos de instalación iOS. No incorpora service worker ni caché
offline de datos docentes. Una vez resuelto el nombre tailnet y HTTPS privado desde el iPhone, abre la
URL en Safari y usa **Añadir a pantalla de inicio**. La prueba de interfaz móvil disponible corre en
Chromium; Safari/iPhone real queda pendiente de una validación manual en ese dispositivo.

## Integración ChatGPT

Para conectar ChatGPT desde la instancia HTTPS, registra con OpenAI un cliente OAuth **público** cuya
URL de retorno exacta sea `<APP_ORIGIN>/auth/callback`. Configura el ID recibido en
`CHATGPT_OAUTH_CLIENT_ID` y despliega la aplicación. No se copia ninguna sesión desde un equipo local.

Entra en Alfred como administrador y pulsa **Continuar con ChatGPT**. El navegador va a OpenAI, vuelve
al callback HTTPS de Alfred y la conexión queda guardada en el servidor. La sesión de Alfred que inicia
el proceso debe seguir activa; `state`, PKCE, nonce e identidad se comprueban antes de aceptar tokens.

El cliente OAuth debe poder solicitar `offline_access`, `resource.invoke` y
`chatgpt.tokens.use.direct`. El registro OAuth web para identidad y el permiso de uso del plan son
capacidades distintas: si OpenAI no autoriza este último, Alfred mostrará la cuenta conectada, pero no
usará ChatGPT para inferencia. Este acceso requiere la autorización y el cliente apropiados de OpenAI;
configurar un ID cualquiera no los concede. No se ha validado aún con un cliente real.

En una instalación local abierta en `http://127.0.0.1:<PORT>`, sigue disponible el callback loopback del
flujo open-source. El arranque de producción elimina locks OAuth huérfanos antes de abrir el proceso web.
No borres `data/auth/chatgpt.json`: contiene el registro OAuth activo y el secreto local de alias.

Documentación oficial:

- [OAuth web de OpenAI](https://developers.openai.com/siwc/website)
- [Uso del plan en aplicaciones abiertas](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Modelos e inferencia](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)

## Límites del contenedor

Compose aplica límites de CPU/memoria/procesos, elimina capacidades Linux, activa `no-new-privileges`,
usa usuario sin privilegios y rota logs Docker (`10m`, tres archivos). Las trazas de IA no almacenan
cuerpos nuevos y la interfaz administrativa redacta los campos de cuerpos históricos. No actives logs de
request body en Coolify o en capas de proxy.
