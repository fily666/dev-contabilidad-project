import { Fragment } from "react";

/** Ranuras de la paleta categorica: orden fijo, nunca ciclado. */
export type SerieColor = 1 | 2 | 3 | 4 | 5;

export const SERIES: SerieColor[] = [1, 2, 3, 4, 5];

/** Color base de una serie (el paso validado del tema activo). */
export function colorSerie(serie: SerieColor): string {
  return `var(--chart-${serie})`;
}

/**
 * Degradado de una marca: del paso base al realce del tema (mas claro en
 * oscuro, mas oscuro en claro), de modo que el contraste contra la superficie
 * nunca baja del paso validado.
 */
export function degradadoSerie(serie: SerieColor, hacia: "arriba" | "derecha"): string {
  const base = colorSerie(serie);
  const punta = `color-mix(in oklab, ${base} 72%, var(--marca-realce))`;
  return `linear-gradient(to ${hacia === "arriba" ? "top" : "right"}, ${base}, ${punta})`;
}

/** Halo de la marca, en el propio tono de la serie. */
export function brilloSerie(serie: SerieColor): string {
  return `drop-shadow(0 0 5px color-mix(in oklab, ${colorSerie(serie)} 55%, transparent))`;
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
            <linearGradient id={`deg-${n}-v`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" style={{ stopColor: `var(--chart-${n})` }} />
              <stop
                offset="100%"
                style={{
                  stopColor: `color-mix(in oklab, var(--chart-${n}) 72%, var(--marca-realce))`,
                }}
              />
            </linearGradient>
            <linearGradient id={`deg-${n}-h`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: `var(--chart-${n})` }} />
              <stop
                offset="100%"
                style={{
                  stopColor: `color-mix(in oklab, var(--chart-${n}) 72%, var(--marca-realce))`,
                }}
              />
            </linearGradient>
          </Fragment>
        ))}
      </defs>
    </svg>
  );
}
