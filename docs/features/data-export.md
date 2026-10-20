# Exportación de datos

## Alcance

Selección y descarga local de datos de Alfred como CSV UTF-8 o libro Excel `.xlsx` con una o varias hojas.

## Flujo actual

Administración consulta el catálogo cerrado en `/api/admin/exports`. La profesora selecciona uno o varios
conjuntos; CSV admite uno y Excel crea una hoja por conjunto. El Route Handler valida el cuerpo con Zod,
consulta read models explícitos y devuelve el archivo con descarga y `no-store`.

## Fuente de verdad e invariantes

- Solo pueden exportarse los conjuntos enumerados en `src/domain/data-export.ts`.
- La exportación se genera localmente y nunca llama a IA ni a servicios externos.
- Los CSV incluyen BOM UTF-8, comillas y saltos CRLF; Excel conserva números, booleanos y fechas tipados.
- Todo texto que pueda interpretarse como fórmula se neutraliza para evitar CSV/Excel injection.
- El conjunto de consumo cloud excluye cuerpos de peticiones, respuestas, credenciales y razonamiento.
- La interfaz avisa cuando el archivo contiene datos personales del alumnado.
- Los comentarios del profesorado se exportan como conjunto propio con original, versión familiar y estado.

## Puntos de entrada

- UI: `src/components/admin-view.tsx`
- API: `src/app/api/admin/exports/route.ts`
- Servicio: `src/services/data-export-service.ts`
- Repositorio: `src/repositories/data-export-repository.ts`
- Dominio: `src/domain/data-export.ts`
- Pruebas: `tests/domain/data-export.test.ts`, `tests/integration/observation-flow.test.ts`

## Checklist de cambio

- Probar catálogo permitido, formato, tipos, caracteres especiales y archivo vacío.
- Verificar neutralización de `=`, `+`, `-`, `@`, tabuladores y retornos al inicio de texto.
- Mantener cada hoja legible: cabecera fija, nombres claros, anchuras razonables y sin contenido recortado.
- Security es obligatorio al añadir columnas personales, conversaciones o logs.
