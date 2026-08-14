// scripts/lib/plan-publicacion.mjs
//
// Construccion del "plan" de una publicacion web y de su planHash.
//
// El planHash es la firma de TODO lo que se aprueba: si cualquier pieza cambia
// entre la verificacion y la publicacion —el commit de partida, el remoto, el
// Excel, el paquete generado, la lista de archivos, los conteos o el hecho de
// que se retire contenido— el hash deja de coincidir y la aprobacion caduca.
// Asi una autorizacion no puede reutilizarse para publicar algo distinto de lo
// que se reviso.

import crypto from "node:crypto";
import fs from "node:fs";

export const RUTAS_PUBLICABLES = ["public/data/rumbo/", "src/data/generated/rumbo-web/"];

export function sha256Archivo(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

export function sha256Texto(t) {
  return crypto.createHash("sha256").update(t, "utf-8").digest("hex");
}

/**
 * Serializacion canonica y estable del plan. El orden de las claves y de las
 * listas es fijo para que el mismo estado produzca siempre el mismo hash.
 */
export function serializarPlan(plan) {
  const canonico = {
    headInicial: plan.headInicial,
    originMainInicial: plan.originMainInicial,
    hashExcel: plan.hashExcel,
    publicacionWebId: plan.publicacionWebId,
    manifestSha256: plan.manifestSha256,
    anadidos: [...plan.anadidos].sort(),
    modificados: [...plan.modificados].sort(),
    eliminados: [...plan.eliminados].sort(),
    hashesNuevos: Object.keys(plan.hashesNuevos)
      .sort()
      .map((k) => `${k}:${plan.hashesNuevos[k]}`),
    conteos: ordenarObjeto(plan.conteos),
    retira: Boolean(plan.retira),
    urlBase: plan.urlBase,
  };
  return JSON.stringify(canonico);
}

function ordenarObjeto(o) {
  if (!o || typeof o !== "object") return o;
  const out = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? ordenarObjeto(o[k]) : o[k];
  }
  return out;
}

export function calcularPlanHash(plan) {
  return sha256Texto(serializarPlan(plan));
}

/** Componentes protegidos, para poder explicar cual cambio. */
export function componentesDelPlan(plan) {
  return {
    headInicial: plan.headInicial,
    originMainInicial: plan.originMainInicial,
    hashExcel: plan.hashExcel,
    publicacionWebId: plan.publicacionWebId,
    manifestSha256: plan.manifestSha256,
    archivos: `${plan.anadidos.length}+${plan.modificados.length}+${plan.eliminados.length}`,
    conteos: JSON.stringify(ordenarObjeto(plan.conteos)),
    retira: String(Boolean(plan.retira)),
    urlBase: plan.urlBase,
  };
}
