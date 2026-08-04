# Cierre automático de publicaciones RUMBO — implementación y rollback

Rama: `feature/redes-cierre-automatico`. Base protegida: commit
`95611a6` en `main` ("Estado funcional actualizado antes del cierre automático
de publicaciones").

## Respaldos creados (antes de cualquier cambio)

- `RESPALDOS_RUMBO/RUMBO_COMPLETO_2026-08-03_2003.zip` — toda la carpeta RUMBO
  (112 archivos, 44 carpetas, 84.3 MB sin comprimir).
- `RESPALDOS_RUMBO/RUMBO_ARCHIVO_MAESTRO_..._RESPALDO_2026-08-03_2003.xlsx` —
  copia individual del Excel maestro **antes** de añadir columnas.
- `RESPALDOS_CODEBASE/CODEBASE_RumboJourneysWeb_2026-08-03_2003.zip` — codebase
  (169 archivos, sin `node_modules` ni secretos).

## Modelo de datos (Excel, hoja `21_PUBLICACIONES_REDES`)

Columnas nuevas (Z–AI), se conservan todas las anteriores:
`facebook_estado, instagram_estado, facebook_fecha_intento,
instagram_fecha_intento, facebook_fecha_publicacion,
instagram_fecha_publicacion, facebook_intentos, instagram_intentos,
facebook_error, instagram_error`.

Catálogo `publicacion_redes_estado` ampliado con: `en_proceso`,
`publicada_parcial`, `pendiente_seguro`.
Catálogo nuevo `red_estado`: `no_aplica, pendiente, en_proceso, publicada,
error, indeterminado`.

No se alteraron filas de Jornadas, Carreras, Historias, Rutas ni Medios.

## Carpetas terminales (OneDrive, dentro de RUMBO)

`06_PUBLICADOS`, `07_PUBLICADOS_PARCIAL`, `08_ERRORES`.
`05_LISTOS_PUBLICAR` se mantiene como la única carpeta vigilada por Make.

## Scripts

- `scripts/preparar-publicacion-redes.mjs` (modificado): marca de idempotencia,
  `redes_autorizadas/redes_completadas/omitir_redes`, consciencia de reintento,
  inicialización de estado/intentos por red.
- `scripts/registrar-resultado-redes.mjs` (nuevo): registro, reconciliación,
  EN_PROCESO/pendiente_seguro, reintentos por red (≤3), archivado a 06/07/08,
  limpieza de 05, lock, idempotente, logs.
- `scripts/tests/test-cierre-redes.mjs` (nuevo): harness con fixtures ficticios.

## Estado de pruebas

`node --check` OK en los 3 scripts. La suite `test-cierre-redes.mjs` **no pudo
ejecutarse hasta el final en el entorno de trabajo** porque el sandbox quedó
degradado y `exceljs` se colgaba incluso en un libro trivial de 1 celda. La
suite está lista para ejecutarse en un entorno sano:

```
cd "C:\\Users\\carol\\Rumbo Journeys Web"
node scripts/tests/test-cierre-redes.mjs           # todos los escenarios
node scripts/tests/test-cierre-redes.mjs 1 2 3     # por lotes
```

Usa solo fixtures en un temporal; no toca el entorno operativo ni Make.

## Nota de compatibilidad del Excel maestro

Las columnas/catálogos se aplicaron con `openpyxl`. Los scripts leen/escriben el
Excel con `exceljs`. Por la degradación del sandbox no se pudo verificar que
`exceljs` lea el maestro editado. **Validación pendiente en entorno sano** (una
línea): abrir el maestro con `exceljs` y confirmar que lee la hoja 21 con 35
columnas. Si fallara, basta abrir y guardar el maestro en Excel de escritorio (lo
normaliza) o re-guardarlo con `exceljs`. Rollback total con la copia individual
del Excel.

## Rollback (completo y por partes)

1. **Código**: `git checkout main` (vuelve al estado `95611a6`). Descartar la
   rama: `git branch -D feature/redes-cierre-automatico`.
2. **Excel maestro**: copiar de nuevo
   `RESPALDOS_RUMBO/RUMBO_ARCHIVO_MAESTRO_..._RESPALDO_2026-08-03_2003.xlsx`
   sobre `RUMBO/RUMBO_ARCHIVO_MAESTRO_V6_INTEGRACION_WEB.xlsx`.
3. **Carpetas**: borrar `06_PUBLICADOS`, `07_PUBLICADOS_PARCIAL`, `08_ERRORES`
   (están vacías salvo `_LEEME.txt`).
4. **Restauración total de RUMBO**: descomprimir
   `RESPALDOS_RUMBO/RUMBO_COMPLETO_2026-08-03_2003.zip`.
5. **Restauración total del codebase**: descomprimir
   `RESPALDOS_CODEBASE/CODEBASE_RumboJourneysWeb_2026-08-03_2003.zip`.

Make **no se tocó**: no hay rollback de Make necesario.
