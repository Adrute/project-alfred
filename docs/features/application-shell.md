# Navegación y estructura de la aplicación

## Alcance

Estructura global de Alfred, menú lateral, navegación entre vistas, cabecera, comportamiento responsive y
persistencia de preferencias puramente visuales.

## Flujo actual

`alfred-app.tsx` mantiene la vista activa y presenta el menú en todas las pantallas. En escritorio, la
profesora puede colapsarlo a una barra de iconos o volver a expandirlo; la preferencia se conserva en
`localStorage`. En móvil se mantiene la navegación horizontal completa para no ocultar etiquetas.

## Fuente de verdad e invariantes

- El estado colapsado solo cambia presentación; no altera la ruta, los datos ni el contexto de Alfred.
- Cada icono conserva nombre accesible y ayuda emergente cuando la etiqueta no está visible.
- El asistente flotante permanece disponible y no debe quedar cubierto por la navegación.
- Las preferencias de interfaz no se guardan en SQLite ni se envían fuera del navegador.

## Puntos de entrada

- Shell y navegación: `src/components/alfred-app.tsx`
- Estilos: `src/app/globals.css`
- Layout raíz: `src/app/layout.tsx`
- Recorrido: `tests/e2e/demo.spec.ts`

## Checklist de cambio

- Probar expandido, colapsado, persistencia tras recarga y cambio de vista.
- Verificar teclado, etiquetas accesibles y anchos de escritorio, tableta y móvil.
- Comprobar que el área de trabajo y la burbuja de Alfred no se solapan.
