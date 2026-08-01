import { Fragment } from "react";

/**
 * DOS escalas de color, y no se cruzan.
 *
 * - **Categórica** (`SerieColor`, 1–5): identidad de una serie. Orden fijo, nunca
 *   ciclado: 1 verdemar (ingresos), 2 azul (egresos), 3 ámbar (inversión), 4 rosa,
 *   5 violeta. Dice *qué* es la marca.
 * - **Semántica** (`TonoSemantico`): estado. Dice si algo está bien, hay que
 *   mirarlo o está mal.
 *
 * Están separadas porque mezclarlas rompe las dos. El caso que lo demostró:
 * los presupuestos pintaban «excedido» con la ranura 2 —el azul de los egresos— y
 * «sobre el 80 %» con la 3 —el ámbar de la inversión—, mientras la insignia del
 * mismo estado, en la misma fila de la tabla, usaba rojo. El mismo presupuesto
 * excedido era rojo en la insignia y azul en su barra, a veinte píxeles. Cuando el
 * color dice dos cosas, deja de decir ninguna.
 *
 * Regla: si el valor responde «cuál de varias cosas es», va la categórica. Si
 * responde «qué tan bien va», va la semántica. Nunca la categórica para estado.
 */

/** Ranuras de la paleta categorica: orden fijo, nunca ciclado. */
export type SerieColor = 1 | 2 | 3 | 4 | 5;

export const SERIES: SerieColor[] = [1, 2, 3, 4, 5];

/** Estados de la escala semantica. Los mismos que usan las insignias. */
export type TonoSemantico = "ok" | "aviso" | "critico";

export const TONOS: TonoSemantico[] = ["ok", "aviso", "critico"];

/**
 * Los tokens semanticos del tema, los mismos de `insignias.tsx`: una barra y su
 * insignia no pueden discrepar si leen del mismo sitio.
 */
const TOKEN_TONO: Record<TonoSemantico, string> = {
  ok: "var(--success)",
  aviso: "var(--warning)",
  critico: "var(--destructive)",
};

/** Color base de una serie (el paso validado del tema activo). */
export function colorSerie(serie: SerieColor): string {
  return `var(--chart-${serie})`;
}

/** Color base de un estado. */
export function colorTono(tono: TonoSemantico): string {
  return TOKEN_TONO[tono];
}

/**
 * Degradado de una marca: del paso base al realce del tema (mas claro en
 * oscuro, mas oscuro en claro), de modo que el contraste contra la superficie
 * nunca baja del paso validado.
 */
export function degradadoSerie(serie: SerieColor, hacia: "arriba" | "derecha"): string {
  return degradadoDe(colorSerie(serie), hacia);
}

/** Mismo tratamiento de marca para un estado. */
export function degradadoTono(tono: TonoSemantico, hacia: "arriba" | "derecha"): string {
  return degradadoDe(colorTono(tono), hacia);
}

function degradadoDe(base: string, hacia: "arriba" | "derecha"): string {
  const punta = `color-mix(in oklab, ${base} 72%, var(--marca-realce))`;
  return `linear-gradient(to ${hacia === "arriba" ? "top" : "right"}, ${base}, ${punta})`;
}

/** Halo de la marca, en el propio tono de la serie. */
export function brilloSerie(serie: SerieColor): string {
  return brilloDe(colorSerie(serie));
}

export function brilloTono(tono: TonoSemantico): string {
  return brilloDe(colorTono(tono));
}

function brilloDe(base: string): string {
  return `drop-shadow(0 0 5px color-mix(in oklab, ${base} 55%, transparent))`;
}

/** Vertical y horizontal de un mismo tono, con la nomenclatura `deg-<clave>-v|h`. */
function ParDeDegradados({ clave, base }: { clave: string; base: string }) {
  const punta = `color-mix(in oklab, ${base} 72%, var(--marca-realce))`;

  return (
    <>
      <linearGradient id={`deg-${clave}-v`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" style={{ stopColor: base }} />
        <stop offset="100%" style={{ stopColor: punta }} />
      </linearGradient>
      <linearGradient id={`deg-${clave}-h`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" style={{ stopColor: base }} />
        <stop offset="100%" style={{ stopColor: punta }} />
      </linearGradient>
    </>
  );
}

/**
 * Degradados compartidos por las graficas en SVG.
 * Se monta una sola vez por documento para que las marcas puedan
 * referenciarlos con `url(#...)` sin generar identificadores por instancia.
 */
export function DefinicionesGraficas() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="0"
      height="0"
      className="pointer-events-none absolute"
    >
      <defs>
        {SERIES.map((n) => (
          <Fragment key={n}>
            <ParDeDegradados clave={`${n}`} base={`var(--chart-${n})`} />
          </Fragment>
        ))}
        {/*
          Los mismos degradados para la escala semántica, con el prefijo `tono`.
          Existen aunque hoy solo los use el medidor lineal —que dibuja con CSS y
          no los necesita—: sin ellos, la primera gráfica en SVG que quiera pintar
          un estado tendría que volver a la escala categórica, que es justo el
          error que esta separación corrige.
        */}
        {TONOS.map((t) => (
          <Fragment key={t}>
            <ParDeDegradados clave={`tono-${t}`} base={TOKEN_TONO[t]} />
          </Fragment>
        ))}
      </defs>
    </svg>
  );
}
