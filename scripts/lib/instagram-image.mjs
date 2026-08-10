// scripts/lib/instagram-image.mjs
//
// Reglas y generacion de derivados compatibles con Instagram Foto para RUMBO.
// NUNCA modifica el original: genera un DERIVADO "<base>__instagram.jpg".
// Instagram Foto admite relacion de aspecto (ancho/alto) entre 0.8 (4:5) y
// 1.91 (1.91:1). Fuera de ese rango se genera un derivado con recorte CENTRADO
// al limite mas cercano y, si hace falta, reduccion a IG_MAX_WIDTH (sin ampliar).
//
// Se usa desde:
//   - sync-rumbo.mjs (genera el derivado en public/data/rumbo/archivos/imagenes)
//   - preparar-publicacion-redes.mjs (decide la url_publica y bloquea si falta)
// para no duplicar las reglas.

import fs from "node:fs";
import path from "node:path";

export const IG_RATIO_MIN = 0.8; // 4:5
export const IG_RATIO_MAX = 1.91; // 1.91:1
export const IG_MAX_WIDTH = 1440; // ancho maximo del derivado (nunca amplia)
export const SUFIJO_INSTAGRAM = "__instagram";

export function nombreDerivadoInstagram(nombreArchivo) {
  const ext = path.extname(nombreArchivo || "") || ".jpg";
  const base = path.basename(nombreArchivo || "medio", ext);
  return `${base}${SUFIJO_INSTAGRAM}.jpg`; // el derivado siempre es JPEG
}

export function ratioDe(w, h) {
  w = Number(w);
  h = Number(h);
  return w > 0 && h > 0 ? w / h : null;
}

export function necesitaDerivadoInstagram(w, h) {
  const r = ratioDe(w, h);
  if (r === null) return false;
  return r < IG_RATIO_MIN || r > IG_RATIO_MAX;
}

// Calcula el recorte centrado y el tamano final del derivado.
export function planDerivadoInstagram(w, h) {
  w = Number(w);
  h = Number(h);
  const r = ratioDe(w, h);
  let cropW = w;
  let cropH = h;
  if (r > IG_RATIO_MAX) {
    // demasiado ancha -> recortar ancho a 1.91:1, conservar toda la altura
    cropW = Math.floor(IG_RATIO_MAX * h);
    cropH = h;
  } else if (r < IG_RATIO_MIN) {
    // demasiado alta -> recortar alto a 4:5, conservar todo el ancho
    cropW = w;
    cropH = Math.floor(w / IG_RATIO_MIN);
  }
  const left = Math.floor((w - cropW) / 2);
  const top = Math.floor((h - cropH) / 2);
  // reduccion a ancho maximo sin ampliar
  let outW = cropW;
  let outH = cropH;
  if (cropW > IG_MAX_WIDTH) {
    outW = IG_MAX_WIDTH;
    outH = Math.round(cropH * (IG_MAX_WIDTH / cropW));
  }
  return {
    cropW,
    cropH,
    left,
    top,
    outW,
    outH,
    ratioOriginal: r === null ? null : Number(r.toFixed(4)),
    ratioFinal: outH > 0 ? Number((outW / outH).toFixed(4)) : null,
  };
}

// Genera el derivado con sharp (import dinamico para no exigir la dependencia si
// no hay imagenes fuera de rango). Idempotente: no regenera si el derivado ya
// existe y es igual o mas nuevo que el origen. Devuelve un objeto de traza; si no
// se pudo generar devuelve { error }.
export async function generarDerivadoInstagram({ srcPath, w, h, destDir, nombreArchivo }) {
  const nombre = nombreDerivadoInstagram(nombreArchivo);
  const destPath = path.join(destDir, nombre);
  const plan = planDerivadoInstagram(w, h);
  try {
    if (fs.existsSync(destPath) && fs.existsSync(srcPath)) {
      const st = fs.statSync(destPath);
      const ss = fs.statSync(srcPath);
      if (st.mtimeMs >= ss.mtimeMs) {
        return { ok: true, generado: false, yaExistia: true, nombre, destPath, ...plan };
      }
    }
    const sharp = await import("sharp").then((m) => m.default).catch(() => null);
    if (!sharp) return { ok: false, error: "sharp_no_disponible", nombre, destPath, ...plan };
    await fs.promises.mkdir(destDir, { recursive: true });
    await sharp(srcPath)
      .extract({ left: plan.left, top: plan.top, width: plan.cropW, height: plan.cropH })
      .resize({ width: plan.outW, height: plan.outH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(destPath);
    return { ok: true, generado: true, yaExistia: false, nombre, destPath, ...plan };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), nombre, destPath, ...plan };
  }
}
