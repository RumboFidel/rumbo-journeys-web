# Diseño de los cambios en Make — cierre automático de publicaciones RUMBO

> ESTADO: **solo diseño, NO implementar todavía** (se están terminando las
> pruebas de Instagram). No activar Make, no publicar, no cambiar conexiones ni
> módulos del escenario actual hasta autorización expresa.

## 0. Antes de tocar nada: duplicar el escenario

1. En Make, abrir el escenario actual de RUMBO (Instagram/Facebook).
2. Menú del escenario → **Clone** → nombrarlo `RUMBO Redes v2 (cierre automatico)`.
3. Trabajar SIEMPRE sobre el clon. El escenario actual queda intacto como
   respaldo y como productivo hasta validar el v2.
4. Exportar el blueprint del escenario actual (menú → **Export Blueprint**) y
   guardarlo junto a los respaldos, por si hay que restaurar.

## 1. Principio

- Make **solo** trabaja con archivos JSON en OneDrive; **nunca** lee ni escribe
  el Excel. Su única fuente de "redes ya publicadas" es
  `RESULTADO_PUBLICACION__<id>.json` y el marcador de reintento (`omitir_redes`,
  `redes_completadas`).
- El Excel lo actualiza Cowork (`registrar-resultado-redes.mjs`).

## 2. Módulos del escenario v2 (orden)

1. **Watch files (OneDrive)** — carpeta `RUMBO/05_LISTOS_PUBLICAR`.
   - Filtro de nombre: empieza por `LISTO_PARA_PUBLICAR__` y termina en `.json`.
   - Excluir `EN_PROCESO__*`, `RESULTADO_PUBLICACION__*` y `.reintento__*`.

2. **OneDrive — Move/Rename a File** (bloqueo inmediato):
   - Renombrar `LISTO_PARA_PUBLICAR__<id>.json` → `EN_PROCESO__<id>.json`.
   - Efecto: sale del patrón del trigger → no se re-dispara aunque el escenario
     se reinicie o se ejecute de nuevo.

3. **Parse JSON** del manifiesto (`EN_PROCESO__<id>.json`). Campos clave:
   `publicacion_id`, `marca_idempotencia`, `publicar_facebook`,
   `publicar_instagram`, `formato_facebook`, `formato_instagram`,
   `texto_facebook`, `texto_instagram`, `medios[]` (con `ruta_onedrive`),
   `omitir_redes[]`, `redes_completadas[]`, `verificar_antes_de_publicar`.

4. **Cargar RESULTADO previo si existe** (OneDrive — Get a File
   `RESULTADO_PUBLICACION__<id>.json`; si no existe, seguir). Construir el set de
   redes ya con `post_id` (de `redes_completadas` + `RESULTADO`).

5. **Router** con dos rutas: Facebook e Instagram.

### Ruta Facebook

- **Filtro**: `publicar_facebook = true` **Y** facebook NO está en
  `omitir_redes` **Y** facebook sin `post_id` en el RESULTADO.
- Si `verificar_antes_de_publicar = true`:
  - **Verificación** (Facebook — buscar publicaciones recientes de la página)
    filtrando por `marca_idempotencia` en el texto/hashtag oculto.
  - Si aparece → registrar su `post_id`/URL como resultado (NO publicar).
  - Si no aparece → publicar.
  - Si la búsqueda es inconcluyente → escribir resultado `estado=indeterminado`.
- **Descargar medios**: OneDrive — Download a File por cada `medios[].ruta_onedrive`.
- **Publicar** según `formato_facebook`:
  - `post` → Create a Post (texto, con/sin medios);
  - `fotos` → Upload Photo(s);
  - `video` → Upload Video;
  - `reel` → Create a Reel.
  - Al publicar, incluir `marca_idempotencia` (p. ej. como último renglón del
    texto o hashtag `#<marca>`), para poder verificar después.
- **Escribir resultado FB inmediatamente** (módulo siguiente): actualizar
  `RESULTADO_PUBLICACION__<id>.json` añadiendo/actualizando la entrada
  `{red:"facebook", estado, post_id, url, fecha_hora, intento, mensaje_error}`.

### Ruta Instagram

- **Filtro**: `publicar_instagram = true` **Y** instagram NO en `omitir_redes`
  **Y** instagram sin `post_id` **Y** los medios tienen `url_publica` (Instagram
  Graph exige URL pública; si `site_public_base_url` está PENDIENTE, esta ruta
  se salta y se registra `estado=error/indeterminado` según corresponda).
- Misma lógica de verificación previa, publicación por `formato_instagram`
  (`foto|carrusel|reel`) y **escritura inmediata** del resultado IG.

## 3. Escritura de `RESULTADO_PUBLICACION__<id>.json` (incremental)

Recomendado: **un único archivo por publicación, actualizado por red apenas se
obtiene el resultado** (no un archivo final único; no archivos separados por
red). Así, si el escenario cae, el progreso parcial queda persistido y en el
reintento la red ya publicada se omite.

Forma:

```json
{
  "schema_version": "1.0",
  "publicacion_id": "pub-....",
  "marca_idempotencia": "RUMBO::pub-....",
  "resultados": [
    {
      "red": "facebook",
      "estado": "publicada",
      "exito": true,
      "post_id": "1234567890",
      "url": "https://facebook.com/....",
      "fecha_hora": "2026-08-03T20:00:00-05:00",
      "intento": 1,
      "mensaje_error": null
    },
    {
      "red": "instagram",
      "estado": "error",
      "exito": false,
      "post_id": null,
      "url": null,
      "fecha_hora": "2026-08-03T20:00:05-05:00",
      "intento": 1,
      "mensaje_error": "IG: media URL no accesible"
    }
  ]
}
```

Reglas:
- Escribir la entrada de cada red **justo después** de su publicación (ventana
  mínima ante caídas).
- No borrar entradas previas: actualizar la de la red correspondiente.
- `estado` por red: `publicada | error | indeterminado`.

## 4. Resultados y quién archiva

- Make deja el `RESULTADO` en `05_LISTOS_PUBLICAR` y termina. **No mueve
  archivos ni toca el Excel.**
- El archivado (a `06/07/08`), la limpieza de `05` y la actualización del Excel
  los hace `registrar-resultado-redes.mjs` (Cowork), en la misma rutina
  nocturna.

Casos:
- FB éxito + IG error → RESULTADO mixto → Cowork marca `publicada_parcial`.
- Ambas éxito → `publicada`.
- Ninguna → `error`.
- Verificación inconcluyente → `indeterminado` → Cowork marca `pendiente_seguro`.

## 5. Fixtures para probar el v2 (sin publicar de verdad)

Antes de conectar cuentas reales, probar el clon con:
- una publicación de prueba con `publicar_facebook=true`, medios de prueba y
  cuentas/sandbox de prueba;
- simular el reintento poniendo `omitir_redes:["facebook"]` y verificar que la
  ruta FB se salta;
- simular `verificar_antes_de_publicar=true` y comprobar la rama de verificación;
- confirmar que el `RESULTADO` se escribe incremental por red;
- confirmar que el marcador quedó como `EN_PROCESO__` (no re-dispara).

## 6. Qué NO cambiar todavía

- No activar el escenario v2 con cuentas reales.
- No modificar el escenario actual (v1) hasta validar el v2.
- No cambiar conexiones de Facebook/Instagram.
- No publicar contenido real.
