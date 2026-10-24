# Seguridad y verificación offline

## Modelo de protección local

Alfred enlaza solo `127.0.0.1` en local; el contenedor enlaza `0.0.0.0` dentro del bridge y Docker publica
solo el loopback del host. No se incluyen telemetría, CDNs ni analítica. ChatGPT es opcional y la
única integración cloud autorizada; sin iniciar sesión no se realizan llamadas de inferencia. Esto
reduce exposición, pero no implica por sí mismo cumplimiento
del RGPD. Antes de tratar datos reales hacen falta revisión de seguridad, protección de datos,
autorización del centro, gestión de accesos, copias y borrado.

SQLite no cifra datos. Activar FileVault en macOS o BitLocker en Windows y proteger la sesión de
usuario. No incluir bases ni `.env` en Git. Los mensajes y documentos son entrada no confiable; el
modelo no debe acceder a comandos, sistema de archivos o SQL.

## Prueba funcional manual sin Internet

Realizar la instalación antes de la prueba (`npm install`). Después:

1. Desconectar Wi-Fi/Ethernet.
2. Iniciar Alfred sin conectar ChatGPT.
3. Abrir `http://127.0.0.1:3000/api/health`.
4. Ejecutar los escenarios locales y reiniciar Alfred para verificar persistencia.
5. Confirmar que no se intenta ninguna conexión remota y conservar las evidencias sin datos personales.

Esta prueba valida el modo manual. Las funciones de razonamiento avanzado requieren Internet y una
cuenta de ChatGPT autorizada.

## Inspección reproducible en macOS

Con Alfred en ejecución:

```sh
lsof -nP -iTCP -sTCP:LISTEN | grep ':3000'
lsof -nP -iTCP -sTCP:ESTABLISHED | grep node
```

El listener esperado es `127.0.0.1:3000`. Durante la prueba offline no debe aparecer una conexión
establecida de `node` a una dirección remota.
Para una auditoría más profunda, usar las herramientas aprobadas por el centro (por ejemplo, un
firewall de aplicación) y documentar versión y configuración.

## Inspección reproducible en Windows 11

En PowerShell como usuario normal:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -eq 3000 } |
  Select-Object LocalAddress,LocalPort,OwningProcess

Get-NetTCPConnection -State Established |
  Where-Object { $_.OwningProcess -in (Get-Process node -ErrorAction SilentlyContinue).Id } |
  Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,OwningProcess
```

El resultado esperado para Alfred es dirección local `127.0.0.1`, no `0.0.0.0` ni la IP LAN. Revisar
cualquier conexión remota antes de usar la aplicación con datos, incluso ficticios.

## Comprobaciones automatizadas actuales

- La configuración acepta `127.0.0.1` en local y `0.0.0.0` exclusivamente para el bind interno de Docker.
- Las pruebas solo permiten endpoints externos de `auth.openai.com` y `api.openai.com` en los módulos
  de OAuth y Responses.
- La seudonimización tiene regresiones para nombres, identificadores, correos, teléfonos y estabilidad
  de alias por conversación.
- **Administración → Logs** permite verificar los metadatos de uso sin exponer cuerpos. Los
  registros se crean antes de la conexión, permanecen solo en SQLite y excluyen credenciales y razonamiento.
- `npm audit --omit=dev` no reportó vulnerabilidades conocidas en dependencias de producción durante
  la creación de la Fase 1.

La dependencia transitiva de desarrollo `braces`, introducida por las herramientas ESLint de Next,
tiene un aviso de denegación de servicio por patrones profundamente anidados. No forma parte del
runtime. No se aplicó `npm audit fix --force` porque propone un downgrade disruptivo; revisar al salir
una versión compatible corregida.
