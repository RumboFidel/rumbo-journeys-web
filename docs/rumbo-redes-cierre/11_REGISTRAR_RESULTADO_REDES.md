# RUTINA 11 — REGISTRAR RESULTADO Y CERRAR PUBLICACIONES DE REDES

## Objetivo

Cerrar de forma automática el ciclo de publicación en redes: leer el resultado
que Make deja en `RESULTADO_PUBLICACION__<publicacion_id>.json`, registrarlo en
`21_PUBLICACIONES_REDES` (estado global y por red), reintentar solo las redes
fallidas, archivar el paquete en su carpeta terminal y limpiar
`05_LISTOS_PUBLICAR`. Todo sin intervención de Fidel.

Esta rutina la ejecuta Cowork **dentro de la rutina nocturna** (no hay tareas
programadas externas), mediante:

```
node scripts/registrar-resultado-redes.mjs --reconciliar
```

y, para una publicación concreta:

```
node scripts/registrar-resultado-redes.mjs --registrar --publicacion-id=<id>
```

Nunca publica en redes ni llama a Make. Solo lee JSON de OneDrive y escribe el
Excel. La verificación real en la plataforma la hace Make; aquí solo se
interpreta su reporte.

## Cuándo se ejecuta

1. **Al inicio de cada rutina nocturna** (reconciliación de pendientes de la
   corrida anterior), antes de procesar la jornada nueva. Un pendiente anterior
   nunca bloquea la jornada nueva.
2. **Después de enviar una publicación a Make** en la misma rutina, cuando ya
   apareció el `RESULTADO`.

## Máquina de estados (columna `estado` de la hoja 21)

- `borrador` → fila creada por Cowork.
- `bloqueada` → la validación de `preparar-publicacion-redes.mjs` halló motivos.
- `lista_para_publicar` → medios copiados y marcador creado.
- `en_proceso` → Make recogió el marcador (lo renombró a `EN_PROCESO__`) y hay
  redes recuperables pendientes de reintento.
- `publicada` → todas las redes autorizadas con éxito.
- `publicada_parcial` → alguna red con éxito y otra definitivamente fallida.
- `error` → ninguna red con éxito (tras agotar intentos).
- `pendiente_seguro` → no se pudo confirmar si publicó; no se republica hasta
  verificar en la siguiente rutina.

Estado por red (`facebook_estado` / `instagram_estado`, catálogo `red_estado`):
`no_aplica | pendiente | en_proceso | publicada | error | indeterminado`.

## Procedimiento del registrador (resumen técnico)

1. Adquiere un `lock` (`.registrando.lock` en `05_LISTOS_PUBLICAR`) para evitar
   ejecuciones simultáneas.
2. Localiza pendientes en `05_LISTOS_PUBLICAR` (archivos `RESULTADO_PUBLICACION__*`
   y `EN_PROCESO__*`).
3. Para cada `publicacion_id`, busca su fila en la hoja 21 y su `RESULTADO`.
4. Por cada red autorizada:
   - si ya tiene `post_id` previo → no se toca (idempotencia);
   - `publicada` en el resultado → guarda `post_id`, URL y fecha;
   - `error` → incrementa `<red>_intentos`; si llega a 3 es definitivo, si no
     queda recuperable;
   - `indeterminado` o sin entrada → marca la red `indeterminado`.
5. Calcula el estado global (ver máquina de estados).
6. Escribe el Excel **antes** de mover archivos (durabilidad) y consume el
   `RESULTADO` (idempotencia).
7. Acción:
   - recuperable → genera marcador de reintento (`omitir_redes` = redes con
     `post_id`, solo reintenta las pendientes);
   - `indeterminado` → genera marcador con `verificar_antes_de_publicar=true`
     (Make comprobará antes de publicar); no republica;
   - terminal → mueve el paquete a `06_PUBLICADOS` / `07_PUBLICADOS_PARCIAL` /
     `08_ERRORES` y lo borra de `05_LISTOS_PUBLICAR`.
8. Escribe un log técnico en `00_HERRAMIENTAS/LOGS/redes-cierre.log`.

## Reintentos

- Máximo **3 intentos por red**, automáticos, con espera entre corridas.
- Nunca se reintenta una red que ya tenga `post_id`.
- Los `post_id`/URL exitosos se conservan y se arrastran al marcador de
  reintento (`redes_completadas`) para que Make omita esas redes.
- Tras el tercer fallo, el paquete va a la carpeta terminal correspondiente y
  Fidel ve "Se requiere tu revisión".

## Idempotencia y seguridad

- Clave única `publicacion_id`.
- Consumir el `RESULTADO` y mover el paquete fuera de `05` impiden reprocesar.
- El renombrado del marcador a `EN_PROCESO__` (lo hace Make) lo saca del patrón
  que dispara el trigger.
- `lock` para no solapar corridas.
- Re-ejecutar el registrador no duplica registros, intentos ni archivos.

## Reglas

- Nunca publica ni llama a Make.
- Nunca escribe en `05_LISTOS_PUBLICAR` los estados operativos: la hoja 21 es la
  maestra de auditoría.
- No republica ante resultados ambiguos (`pendiente_seguro`).
- Fidel no interviene; solo ve el resumen final.
