# Protocolo de orquestación de desarrollo

## Objetivo

Convertir un requisito en un cambio verificable usando la mínima cantidad de agentes y contexto necesaria.
El orquestador conserva requisitos y decisiones; los especialistas reciben únicamente el paquete relevante.

## Entrada obligatoria

1. Ejecuta `npm run branch:check` antes de cualquier edición. Si la rama es `main` o `master`, crea una rama
   descriptiva sin descartar el trabajo existente.
2. Busca el requisito en `docs/features/manifest.json` mediante sus palabras clave.
3. Lee `AGENTS.md`, la ficha funcional elegida y los puntos de entrada que esta enumera.
4. Añade fichas solo cuando el cambio cruce dominios. La exploración global requiere una justificación del
   architect en el paquete de trabajo.

## Clasificación

1. Determina áreas afectadas: arquitectura, backend, frontend, datos, QA, seguridad y documentación.
2. Clasifica el riesgo como `low`, `medium` o `high`.
3. Identifica si hay escritura de datos, autenticación, privacidad, permisos, IA cloud o cambios destructivos.
4. Elige una ruta mínima. Un cambio trivial no necesita reunir a todo el equipo.

## Rutas

| Cambio | Agente principal | Comprobaciones obligatorias |
|---|---|---|
| Texto o documentación | documentation | qa si cambia comandos o conducta |
| UI aislada | frontend | qa |
| API, servicio o dominio | backend | qa |
| Prisma, migración o borrado | data + backend | qa + security |
| Flujo completo | architect, después backend/frontend/data | qa + reviewer |
| Autenticación, privacidad, permisos o IA cloud | especialista propietario | security + qa + reviewer |
| Refactor transversal o requisito ambiguo | architect | especialistas afectados + reviewer |
| Incidencia sin petición de arreglo | especialista propietario en lectura | qa para reproducir; no escribir |

## Paralelismo y propiedad

- Máximo tres especialistas activos además del orquestador.
- Solo se paralelizan tareas independientes y preferentemente de lectura.
- Hay un único escritor sobre el árbol compartido en cada momento.
- QA puede escribir pruebas únicamente cuando recibe explícitamente la propiedad de esa fase.
- Documentation solo modifica documentación; architect solo planes/decisiones.
- Security y reviewer son independientes y no corrigen su propio hallazgo salvo encargo posterior.
- No se crean agentes para una tarea que el orquestador puede resolver de forma directa y segura.

## Política de modelos y tokens

- `economy`: inventario, búsquedas, documentación mecánica, ejecución de pruebas y comprobaciones claras.
- `balanced`: implementación normal y orquestación.
- `deep`: decisiones con alternativas, seguridad, privacidad, concurrencia, migraciones arriesgadas y revisión final.
- Escala un nivel solo si hay ambigüedad real, dos intentos fallidos, riesgo alto o una contradicción entre evidencias.
- Reduce de nuevo el perfil al terminar la fase compleja.
- Devuelve resúmenes y referencias, nunca volcados completos de logs o archivos ya accesibles.
- Reutiliza evidencia existente; no repitas exploraciones ni la batería completa antes de que haya cambios.

## Paquete de delegación

Cada encargo debe incluir:

```text
Objetivo:
Alcance y archivos permitidos:
Hechos ya comprobados:
Restricciones y riesgos:
Resultado esperado:
Validación requerida:
```

El especialista responde con:

```text
Resultado:
Archivos o símbolos afectados:
Pruebas/evidencias:
Riesgos o decisiones pendientes:
Recomendación al orquestador:
```

## Puertas de calidad

1. El propietario implementa y realiza pruebas focalizadas.
2. QA comprueba regresiones y el recorrido observable.
3. Security interviene en todo cambio de riesgo alto o sensible.
4. Reviewer examina el diff final en cambios transversales o de riesgo medio/alto.
5. Documentation actualiza `CHANGELOG.md`, las fichas funcionales, configuración, arquitectura y uso.
6. Reviewer comprueba que la rama no sea protegida y que documentación y pruebas correspondan al diff.
7. El orquestador ejecuta la definición de terminado de `AGENTS.md` y entrega un único informe consolidado.

## Integración

- Los agentes pueden preparar commits o una pull request solo si se les solicita, siempre desde la rama de trabajo.
- Ningún agente hace merge, rebase ni push directo a `main` o `master` por iniciativa propia.
- El merge requiere una confirmación explícita del propietario para la entrega concreta, después de revisar
  el resumen, el diff y las comprobaciones.
