# Changelog

Este archivo recoge los cambios observables y de arquitectura relevantes de Alfred. Los agentes de
desarrollo deben mantener la sección `Unreleased`; las versiones publicadas se cerrarán únicamente al
preparar una entrega.

## [Unreleased]

### Added

- Equipo de desarrollo multiagente neutral, con adaptadores para Codex y Claude Code, perfiles de coste,
  roles especializados y validación automática.
- Catálogo de contexto por funcionalidad en `docs/features/` para trabajar sin explorar todo el repositorio.
- Política verificable de ramas de trabajo y plantilla de pull request con autorización explícita de merge.
- Integración opcional con ChatGPT, seudonimización local de alumnado, auditoría de peticiones y selección
  de modelo por agente generativo.
- Conversaciones A2A internas auditables, panel de agentes y administración controlada de SQLite.
- Espacios separados para docencia por asignatura, ficha académica, grupo tutor y planificación semanal.

### Changed

- Alfred conserva el contexto de cada conversación, encadena herramientas tipadas y presenta respuestas
  con Markdown seguro bajo una única identidad visual.
- La página de inicio se orienta al trabajo del día y el asistente contextual está disponible en toda la app.

### Fixed

- Las continuaciones conversacionales reutilizan filtros, alumnado y tema previos en vez de perder el foco.
- Las consultas alimentarias se enrutan a la memoria del alumnado y no a la organización de asientos.
- El chat y sus paneles disponen de desplazamiento independiente para conversaciones largas.

### Security

- Los nombres, datos de contacto e identificadores internos del alumnado no se envían a ChatGPT.
- Las escrituras propuestas mediante lenguaje natural requieren validación, `PendingAction` y confirmación.
- Las trazas excluyen credenciales y razonamiento interno y permiten inspeccionar el cuerpo seudonimizado.
