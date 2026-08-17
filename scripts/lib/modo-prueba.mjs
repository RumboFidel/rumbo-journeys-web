// scripts/lib/modo-prueba.mjs
//
// Compuerta compartida entre las rutinas que publican algo hacia fuera.
//
// Hay dos clases de variable de entorno, y no pueden tratarse igual:
//
//   Ajustes operativos legitimos: numeros dentro de limites (esperas, timeouts).
//   Sustituciones peligrosas: las que pueden desviar una publicacion a otro
//   sitio o saltarse comprobaciones sin que nadie lo note.
//
// En una ejecucion operativa, encontrar definida una sustitucion peligrosa es
// motivo de aborto, no de aviso. Una variable de entorno no debe poder cambiar
// en silencio adonde se publica ni que se comprueba.
//
// Esta compuerta vive aqui, y no copiada en cada rutina, porque copiarla seria
// la forma mas probable de que una de las dos se quedase sin actualizar.

/**
 * Comprueba que ninguna sustitucion peligrosa este definida fuera del modo de
 * prueba. Devuelve la lista de las que si estan definidas (util para avisar en
 * modo de prueba); si hay alguna sin modo de prueba, llama a `alAbortar`.
 *
 * @param {string[]} nombres  variables de entorno consideradas peligrosas
 * @param {object}   opciones
 * @param {boolean}  opciones.modoPrueba  true si se paso --modo-prueba
 * @param {object}   opciones.env         entorno a inspeccionar
 * @param {(mensaje: string) => never} opciones.alAbortar
 */
export function comprobarSustituciones(nombres, { modoPrueba, env = process.env, alAbortar }) {
  const definidas = nombres.filter((n) => env[n] !== undefined && env[n] !== "");
  if (definidas.length === 0) return [];
  if (!modoPrueba) {
    alAbortar(
      `Estas variables de entorno solo pueden usarse con --modo-prueba: ${definidas.join(", ")}. ` +
        `Sin esa bandera, una ejecucion operativa podria publicar contra otro destino ` +
        `o saltarse comprobaciones sin dejar rastro. No se hizo nada.`
    );
  }
  return definidas;
}

/**
 * Lee una variable numerica de entorno exigiendo que sea un entero dentro de
 * limites. Fuera de rango aborta: un valor extremo convierte una espera en una
 * espera infinita, o en ninguna espera.
 */
export function numeroEnLimites(nombre, limites, { env = process.env, alAbortar }) {
  const { min, max, pordefecto } = limites;
  const crudo = env[nombre];
  if (crudo === undefined || crudo === "") return pordefecto;
  const n = Number(crudo);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    alAbortar(`${nombre}="${crudo}" no es un numero entero de milisegundos.`);
  }
  if (n < min || n > max) {
    alAbortar(
      `${nombre}=${n} esta fuera de los limites seguros (${min}-${max} ms). ` +
        `Un valor extremo convertiria la espera en una espera infinita o en ninguna espera.`
    );
  }
  return n;
}
