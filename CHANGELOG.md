# Changelog

Este archivo recoge los cambios observables y de arquitectura relevantes de Alfred. Los agentes de
desarrollo deben mantener la sección `Unreleased`; las versiones publicadas se cerrarán únicamente al
preparar una entrega.

## [Unreleased]

### Added

- Acceso local con cuentas y roles, sesiones protegidas, aplicación instalable y archivos de despliegue Docker/Coolify con SQLite persistente.
- Activación local de ChatGPT mediante callback loopback y acceso OAuth web desde el botón en instancias HTTPS con cliente registrado.
- Flujo de comentarios del profesorado por alumno: conserva el original, propone una redacción respetuosa
  para la familia, permite revisarla y la vincula tras confirmación a la próxima tutoría.
- Menú lateral colapsable con preferencia persistente y comportamiento accesible en escritorio y móvil.
- Métricas de tokens por agente generativo, media por petición y gráfica comparativa de consumo.
- Exportación local configurable a CSV o Excel con varias hojas, tipos de datos y protección frente a
  fórmulas inyectadas.
- Equipo de desarrollo multiagente neutral, con adaptadores para Codex y Claude Code, perfiles de coste,
  roles especializados y validación automática.
- Catálogo de contexto por funcionalidad en `docs/features/` para trabajar sin explorar todo el repositorio.
- Política verificable de ramas de trabajo y plantilla de pull request con autorización explícita de merge.
- Integración opcional con ChatGPT, seudonimización local de alumnado, auditoría de peticiones y selección
  de modelo por agente generativo.
- Conversaciones A2A internas auditables, panel de agentes y administración controlada de SQLite.
- Espacios separados para docencia por asignatura, ficha académica, grupo tutor y planificación semanal.

### Changed

- ChatGPT pasa a ser el único proveedor generativo en producción; el interruptor cloud queda como corte de emergencia y las trazas nuevas guardan solo metadatos.
- Alfred conserva el contexto de cada conversación, encadena herramientas tipadas y presenta respuestas
  con Markdown seguro bajo una única identidad visual.
- La página de inicio se orienta al trabajo del día y el asistente contextual está disponible en toda la app.

### Fixed

- El icono de Alfred en la pantalla de inicio de iPhone usa el logo sobre un fondo opaco.
- La ruta OAuth local puede fijarse para recuperar clientes registrados con el callback histórico;
  las conexiones nuevas guardan la ruta para reautorizaciones posteriores.
- La cabecera explica cuando la VPS necesita un cliente OAuth web aprobado por OpenAI.
- ChatGPT aparece disponible para conectar en instalaciones locales sin `CLOUD_AI_ENABLED` explícito;
  `false` conserva el corte de emergencia y la cabecera ya no muestra una desactivación transitoria.
- El seed reutiliza franjas horarias por su clave de calendario y puede repetirse sobre una base existente.
- Las continuaciones conversacionales reutilizan filtros, alumnado y tema previos en vez de perder el foco.
- Las consultas alimentarias se enrutan a la memoria del alumnado y no a la organización de asientos.
- El chat y sus paneles disponen de desplazamiento independiente para conversaciones largas.

### Security

- Las operaciones de la aplicación requieren sesión; las mutaciones validan origen y token CSRF, y los endpoints administrativos requieren rol admin.
- La dependencia transitiva `fast-uri` se fuerza a una versión corregida para eliminar avisos de validación de URI en el runtime de migraciones.
- Los nombres, datos de contacto e identificadores internos del alumnado no se envían a ChatGPT.
- Las escrituras propuestas mediante lenguaje natural requieren validación, `PendingAction` y confirmación.
- Las trazas excluyen credenciales, cuerpos de petición/respuesta y razonamiento interno.
- El callback OAuth valida sesión administradora, `state`, PKCE y nonce antes de activar la conexión.
- La frontera de OpenAI bloquea cualquier payload que aún contenga nombres, apellidos, IDs internos o contacto del alumnado; los alias usan el HMAC completo y son únicos por alumno y conversación.
