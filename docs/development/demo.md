# Guion de demostración

## Preparación

```sh
npm install
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run demo:prepare
npm run dev
```

Abrir `http://127.0.0.1:3000`. El seed contiene únicamente datos ficticios: tres grupos, dos
asignaturas, un horario docente, unidades de Inglés y Alemán, un grupo tutor, fichas académicas,
calificaciones, 25 alumnos y cuatro observaciones.

Pulsar **Continuar con ChatGPT** y completar la autorización. Después, en otra terminal, ejecutar
`npm run ai:check` para validar la conexión y la salida estructurada.

## Recorrido sugerido (12–15 minutos)

1. En **Inicio**, señalar que los datos permanecen locales, que ChatGPT es opcional y mostrar las métricas.
2. Abrir **Planificación**, navegar entre semanas y seleccionar la sesión planificada de Present
   Perfect. Mostrar actividades, duración, unidad, aula y etiqueta de estado.
3. Abrir **Configurar horario**. Explicar que las franjas son recurrentes y que Alfred genera una sola
   sesión por fecha aunque se visite la semana varias veces.
4. Pulsar **Organizar con Alfred** y confirmar la propuesta para la próxima semana.
5. Abrir **Mis asignaturas**, seleccionar `Inglés · 2.º ESO C` y mostrar que la ficha de cada alumno
   conserva únicamente sus calificaciones y seguimiento de esa asignatura.
6. Abrir **Mi tutoría** y mostrar el mismo alumnado desde la responsabilidad tutorial: seguimiento
   general, familias, reuniones y acuerdos, sin mezclarlo con las calificaciones.
7. Abrir **Chat con Alfred** y escribir: `Alfred, quiero contarte algunas cosas sobre mis alumnos`.
8. Escribir `Lucas participa mucho en clase`. Mostrar que todavía no se ha guardado; confirmar.
9. Recargar el navegador y preguntar `¿Qué sabes de Lucas?`. Alfred recupera la memoria persistida y
   distingue hechos registrados.
10. Conectar ChatGPT y pedir `Prepárame una tutoría con la familia de Lucas`. Explicar que ChatGPT razona con un alias, que
   las propuestas aparecen separadas de los hechos y que guardar requiere confirmación.
11. En **Mi tutoría**, editar notas, añadir un acuerdo y marcar la reunión como realizada.
12. Pedir `Organiza los 25 alumnos en cinco filas de cinco`. Confirmar el plano.
13. En **Organización del aula**, enseñar pizarra, profesora y 25 pupitres. Seleccionar dos pupitres para
   intercambiarlos; un cambio que rompa una restricción obligatoria será rechazado.
14. Registrar `Lucas y Marcos están trabajando mejor juntos últimamente`. Confirmar y explicar que la
   observación anterior se conserva, mientras la preferencia activa cambia.
15. En **Alumnos**, editar o eliminar una observación de demostración y mostrar la confirmación de
    borrado.
16. En **Grupos**, abrir una clase y mostrar su listado y el alta de varios alumnos en un único
    formulario.
17. Pedir a Alfred: `Durante 2027-2028 tengo Música con 4.º ESO A los lunes y miércoles de 8:00 a
    9:00`. Revisar las franjas exactas y confirmar.

## Conversaciones con contexto propio

1. Abre **Chat con Alfred** y pulsa **Nueva conversación**.
2. Pregunta: «Vamos a organizar una excursión y estoy preparando los menús de la comida, ¿tengo que
   tener algo en cuenta sobre algún alumno?».
3. Continúa con «¿Y alguno más?». Alfred mantiene el tema alimentario sin reorganizar el aula.
4. Crea otra conversación y haz una consulta distinta.
5. Alterna entre ambas desde el historial lateral y comprueba que los mensajes no se mezclan.

## Administración de agentes

1. Abre **Administración** y selecciona un agente.
2. Revisa sus capacidades, ejecuciones, tasa de éxito, duración media y actividad reciente.
3. Detén un agente que no necesites en el siguiente paso y comprueba el estado **Detenido**.
4. Inícialo de nuevo y usa **Reiniciar** para comprobar el contador de reinicios.
5. Abre **Conversaciones A2A** y enseña la solicitud, el agente destinatario, la respuesta y los datos
   estructurados del último intercambio.
6. Con ChatGPT conectado, selecciona Alfred y elige uno de los modelos ofrecidos por la cuenta. Repite
   con MemoryAgent y deja TutoringAgent en **Automático**.
7. Abre **Logs**, filtra la operación `alfred chat` y muestra la petición con alias, la respuesta observable,
   el uso de tokens y el identificador de soporte de OpenAI.
8. Pide una respuesta con negritas y una lista; comprueba que se ve formateada tanto en el chat completo
   como en la burbuja, sin mostrar los caracteres `**`.

## Verificación antes de enseñar

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

No usar datos reales de menores. La aplicación no puede tratar datos reales hasta completar la
revisión de seguridad y protección de datos y recibir autorización formal del centro.
