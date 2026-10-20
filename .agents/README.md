# Sistema de agentes de desarrollo

Este directorio es la fuente de verdad neutral del equipo virtual de desarrollo de Alfred. No contiene
agentes funcionales de la aplicación (`src/agents`), sino responsabilidades para construirla y revisarla.

- `manifest.json`: catálogo, perfiles de capacidad y alcance de escritura.
- `orchestration.md`: clasificación, rutas, handoffs y límites de coste.
- `roles/`: contrato canónico de cada especialista.
- `../docs/features/`: índice de contexto y fichas funcionales que evitan explorar todo el repositorio.
- `../CHANGELOG.md`: registro común de cambios pendientes de publicación.
- `.codex/agents/`: adaptadores ejecutables para Codex.
- `.claude/agents/`: adaptadores ejecutables para Claude Code.
- `AGENTS.md` y `CLAUDE.md`: puntos de entrada de cada herramienta.

Una herramienta distinta puede participar leyendo `AGENTS.md`, `manifest.json`, `orchestration.md` y el
rol que le asigne el orquestador. Los nombres de modelos no forman parte de los contratos de rol: cada
proveedor traduce `economy`, `balanced` y `deep` a sus modelos disponibles.

Validar el catálogo y todos sus adaptadores:

```sh
npm run agents:validate
npm run branch:check
```

Todo trabajo comienza en una rama admitida y termina con el changelog y la ficha funcional actualizados.
La integración en `main` queda reservada a una confirmación explícita del propietario.
