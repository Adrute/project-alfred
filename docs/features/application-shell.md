# Navegación y estructura de la aplicación

## Alcance

Estructura global de Alfred, acceso tras autenticación, menú lateral, navegación entre vistas, cabecera,
comportamiento responsive y persistencia de preferencias puramente visuales.

## Flujo actual

La ruta de inicio exige una sesión local y ofrece la página de acceso cuando no hay cuenta activa.
`alfred-app.tsx` mantiene la vista activa y presenta opciones según el rol; Administración solo se
muestra a `admin`. En escritorio, la
profesora puede colapsarlo a una barra de iconos o volver a expandirlo; la preferencia se conserva en
`localStorage`. En móvil se mantiene la navegación horizontal completa para no ocultar etiquetas.

## Fuente de verdad e invariantes

- El estado colapsado solo cambia presentación; no altera la ruta, los datos ni el contexto de Alfred.
- Cada icono conserva nombre accesible y ayuda emergente cuando la etiqueta no está visible.
- El asistente flotante permanece disponible y no debe quedar cubierto por la navegación.
- Las preferencias de interfaz no se guardan en SQLite ni se envían fuera del navegador.
- La PWA se declara standalone y no registra service worker ni conserva datos docentes para uso offline.
- El layout contempla safe areas y viewport dinámico; la verificación en Safari/iPhone real sigue pendiente.

## Puntos de entrada

- Shell y navegación: `src/components/alfred-app.tsx`
- Estilos: `src/app/globals.css`
- Layout raíz: `src/app/layout.tsx`
- Recorrido: `tests/e2e/demo.spec.ts`

## Checklist de cambio

- Probar expandido, colapsado, persistencia tras recarga y cambio de vista.
- Verificar teclado, etiquetas accesibles y anchos de escritorio, tableta y móvil.
- Comprobar que el área de trabajo y la burbuja de Alfred no se solapan.
