# Catálogo de funcionalidades

Este directorio es el mapa de contexto del producto. Antes de explorar código, el orquestador selecciona
en `manifest.json` la funcionalidad afectada y cada especialista lee únicamente su ficha, los puntos de
entrada indicados y las reglas globales de `AGENTS.md`.

| Funcionalidad | Cuándo cargarla |
|---|---|
| [Navegación y estructura](application-shell.md) | Menú lateral, layout global y comportamiento responsive |
| [Alfred y conversaciones](assistant-chat.md) | Chat, memoria conversacional, burbuja contextual, formato de respuesta |
| [Alumnado y grupos](students-classrooms.md) | Altas, perfiles generales, observaciones, matrículas y clases/grupos |
| [Asignaturas y seguimiento académico](teaching.md) | Docencia, ficha por asignatura y calificaciones |
| [Tutoría y seguimiento tutorial](tutoring.md) | Grupo tutor, reuniones, acuerdos y tutorandos |
| [Planificación, horario y currículo](planning-curriculum.md) | Calendario docente, sesiones, unidades y contenidos |
| [Organización del aula](classroom-layout.md) | Asientos, restricciones y plano del aula |
| [Agentes, estado y A2A](administration-agents-a2a.md) | Control de agentes, estadísticas e intercambios A2A |
| [ChatGPT, privacidad y logs](cloud-ai-privacy-logs.md) | OAuth, modelos, seudonimización y auditoría cloud |
| [Administración de datos](database-administration.md) | Explorador SQLite, borrado, Prisma y migraciones |
| [Exportación de datos](data-export.md) | Descargas CSV/Excel, conjuntos exportables y seguridad de hojas |

## Regla de carga

1. Buscar por palabras clave en `manifest.json`.
2. Leer la ficha seleccionada completa.
3. Abrir solo los puntos de entrada y pruebas enlazados desde esa ficha.
4. Añadir otra ficha únicamente si el cambio cruza realmente ese límite.
5. Explorar el repositorio entero solo cuando el arquitecto documente por qué el mapa no basta.

Al terminar, se actualiza la ficha si han cambiado sus contratos, recorridos o puntos de entrada y se
añade una entrada a `CHANGELOG.md` bajo `Unreleased`.
