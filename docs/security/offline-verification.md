# Seguridad y verificación offline

## Modelo de protección local

Alfred enlaza solo `127.0.0.1`; Ollama se acepta únicamente en loopback. No se incluyen proveedores
cloud, telemetría, CDNs ni analítica. Esto reduce exposición, pero no implica por sí mismo cumplimiento
del RGPD. Antes de tratar datos reales hacen falta revisión de seguridad, protección de datos,
autorización del centro, gestión de accesos, copias y borrado.

SQLite no cifra datos. Activar FileVault en macOS o BitLocker en Windows y proteger la sesión de
usuario. No incluir bases ni `.env` en Git. Los mensajes y documentos son entrada no confiable; el
modelo no debe acceder a comandos, sistema de archivos o SQL.

## Prueba funcional sin Internet

Realizar las descargas antes de la prueba (`npm install` y `ollama pull qwen3.5:9b`). Después:

1. Desconectar Wi-Fi/Ethernet.
2. Iniciar Ollama y Alfred.
3. Abrir `http://127.0.0.1:3000/api/health`.
4. Ejecutar los escenarios locales y reiniciar Alfred para verificar persistencia.
5. Confirmar que no se intenta ningún fallback y conservar las evidencias sin datos personales.

## Inspección reproducible en macOS

Con Alfred y Ollama en ejecución:

```sh
lsof -nP -iTCP -sTCP:LISTEN | grep -E '(:3000|:11434)'
lsof -nP -iTCP -sTCP:ESTABLISHED | grep -E '(node|ollama)'
```

Los listeners esperados son `127.0.0.1:3000` y el endpoint loopback de Ollama. Durante la prueba
offline no debe aparecer una conexión establecida de `node` u `ollama` a una dirección remota.
Para una auditoría más profunda, usar las herramientas aprobadas por el centro (por ejemplo, un
firewall de aplicación) y documentar versión y configuración.

## Inspección reproducible en Windows 11

En PowerShell como usuario normal:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 3000,11434 } |
  Select-Object LocalAddress,LocalPort,OwningProcess

Get-NetTCPConnection -State Established |
  Where-Object { $_.OwningProcess -in (Get-Process node,ollama -ErrorAction SilentlyContinue).Id } |
  Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,OwningProcess
```

El resultado esperado para Alfred es dirección local `127.0.0.1`, no `0.0.0.0` ni la IP LAN. Revisar
cualquier conexión remota antes de usar la aplicación con datos, incluso ficticios.

## Comprobaciones automatizadas actuales

- La configuración rechaza un `HOST` distinto de `127.0.0.1`.
- `OllamaProvider` rechaza URL no loopback.
- `npm audit --omit=dev` no reportó vulnerabilidades conocidas en dependencias de producción durante
  la creación de la Fase 1.

La dependencia transitiva de desarrollo `braces`, introducida por las herramientas ESLint de Next,
tiene un aviso de denegación de servicio por patrones profundamente anidados. No forma parte del
runtime. No se aplicó `npm audit fix --force` porque propone un downgrade disruptivo; revisar al salir
una versión compatible corregida.
