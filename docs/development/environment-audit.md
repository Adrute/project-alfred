# Auditoría del entorno · 16 de octubre de 2026

| Elemento | Resultado observado |
|---|---|
| Equipo | MacBook Air, identificador Mac16,12 |
| Sistema | macOS 26.5.1, build 25F80 |
| Arquitectura | arm64 / Apple Silicon |
| Procesador | Apple M4, 10 núcleos (4 rendimiento + 6 eficiencia) |
| Memoria | 16 GB |
| Node.js | 22.23.3 |
| npm | 10.9.9 |
| Git | 2.50.1 (Apple Git-155) |
| IA | El inventario inicial incluía Ollama; ADR-013 lo sustituyó por ChatGPT como único proveedor generativo con OAuth |
| pnpm / Yarn | No disponibles localmente; Corepack intentó resolverlos por red |

`system_profiler SPHardwareDataType` proporcionó hardware y memoria. Las consultas directas `sysctl`
fueron bloqueadas por el entorno restringido, pero los mismos datos relevantes quedaron disponibles
mediante `system_profiler`. La primera consulta al proveedor inicial quedó bloqueada por el sandbox; la verificación
fuera de esa restricción confirmó el servicio loopback y el modelo configurado.

## Compatibilidad y riesgos

- Node 22 supera el mínimo 20.9 de Next.js 16.
- `better-sqlite3` contiene código nativo: `npm install` debe ejecutarse separadamente en macOS y
  Windows; nunca trasladar `node_modules`.
- Rutas, arranque y configuración usan APIs/formatos multiplataforma. Los comandos documentados
  ofrecen variantes shell y PowerShell.
- La compatibilidad Windows es arquitectónica, no una validación: requiere ejecución real.
- El límite principal para un LLM es la memoria unificada de 16 GB; por ello no se recomienda 14B
  como perfil inicial aunque el artefacto pudiera caber con poco margen.
