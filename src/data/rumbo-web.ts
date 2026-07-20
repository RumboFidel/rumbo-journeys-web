// Capa de datos generada desde el Excel maestro de RUMBO (via
// scripts/sync-rumbo.mjs -> public/data/rumbo -> este espejo en src/).
// No editar estos JSON a mano: se sobreescriben en cada sincronizacion.
import type { CantonWeb, CarreraWeb, HistoriaWeb, MedioWeb, ResumenWeb } from "./types";

import carrerasData from "./generated/rumbo-web/carreras.json";
import historiasData from "./generated/rumbo-web/historias.json";
import cantonesData from "./generated/rumbo-web/cantones.json";
import resumenData from "./generated/rumbo-web/resumen.json";
import mediosData from "./generated/rumbo-web/medios.json";

export const CARRERAS_WEB: CarreraWeb[] = (carrerasData as { carreras: CarreraWeb[] }).carreras;
export const HISTORIAS_WEB: HistoriaWeb[] = (historiasData as { historias: HistoriaWeb[] }).historias;
export const CANTONES_WEB: CantonWeb[] = (cantonesData as { cantones: CantonWeb[] }).cantones;
export const RESUMEN_WEB: ResumenWeb = resumenData as ResumenWeb;
export const MEDIOS_WEB: MedioWeb[] = (mediosData as { medios: MedioWeb[] }).medios;
