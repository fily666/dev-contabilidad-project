"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatearDineroCompacto, formatearMesCorto } from "@/shared/utils/formato";
import { cn } from "@/shared/utils/cn";
import { colorSerie, type SerieColor } from "./definiciones";
import { marcasDeEje } from "./escala";
import { TablaDeDatos } from "./panel-grafica";

export type PuntoFlujo = { mes: string; ingresos: number; egresos: number };

type Props = {
  puntos: PuntoFlujo[];
  moneda: string;
  /** Meses visibles: los mas recientes. */
  maximoMeses?: number;
  altura?: number;
  /**
   * La grafica ocupa el alto que le deje su panel, en vez de los 240 px fijos.
   *
   * Es lo que cierra el hueco de las filas de dos paneles: en una rejilla los dos
   * miden lo que el mas alto, asi que junto a una agenda de diez vencimientos el
   * panel de la grafica crecia hasta ~700 px con un trazo de 240 px arriba y
   * cuatrocientos de nada debajo. Con esto el trazo absorbe la diferencia, sea la
   * que sea, y la fila queda a ras por los dos lados.
   */
  flexible?: boolean;
  className?: string;
};

/** Piso del trazo en modo flexible: por debajo, dos series no se distinguen. */
const ALTURA_MINIMA = 200;

const SERIE_INGRESOS: SerieColor = 1;
const SERIE_EGRESOS: SerieColor = 2;

const MARGEN = { arriba: 14, derecha: 14, abajo: 26, izquierda: 52 };

/**
 * Flujo mensual de ingresos y egresos: dos series sobre un unico eje de
 * valores. Lleva capa de interaccion (mira vertical + globo con los dos
 * valores del mes) y vista de tabla equivalente.
 */
export function GraficoFlujo({
  puntos,
  moneda,
  maximoMeses = 12,
  altura: alturaFija = 240,
  flexible,
  className,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [alto, setAlto] = useState(alturaFija);
  const [activo, setActivo] = useState<number | null>(null);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    const observador = new ResizeObserver(([entrada]) => {
      const caja = entrada?.contentRect;
      if (!caja) return;
      if (caja.width > 0) setAncho(caja.width);
      // En modo flexible el alto lo fija el contenedor (`flex-1`) y no el SVG,
      // asi que medirlo no realimenta el layout.
      if (caja.height > 0) setAlto(Math.max(ALTURA_MINIMA, caja.height));
    });

    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const altura = flexible ? alto : alturaFija;

  const datos = puntos.slice(-maximoMeses);
  const n = datos.length;

  const marcas = marcasDeEje(Math.max(...datos.flatMap((p) => [p.ingresos, p.egresos]), 0));
  const techo = marcas[marcas.length - 1] || 1;

  const anchoTrazo = Math.max(80, ancho - MARGEN.izquierda - MARGEN.derecha);
  const altoTrazo = altura - MARGEN.arriba - MARGEN.abajo;

  const x = (i: number) =>
    n <= 1 ? MARGEN.izquierda + anchoTrazo / 2 : MARGEN.izquierda + (i * anchoTrazo) / (n - 1);
  const y = (valor: number) =>
    MARGEN.arriba + (1 - Math.max(0, Math.min(1, valor / techo))) * altoTrazo;

  const linea = (leer: (p: PuntoFlujo) => number) =>
    datos
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(leer(p)).toFixed(1)}`)
      .join(" ");

  const area = (leer: (p: PuntoFlujo) => number) =>
    n === 0
      ? ""
      : `${linea(leer)} L ${x(n - 1).toFixed(1)} ${(MARGEN.arriba + altoTrazo).toFixed(1)} L ${x(0).toFixed(1)} ${(MARGEN.arriba + altoTrazo).toFixed(1)} Z`;

  const alMover = useCallback(
    (evento: React.PointerEvent<HTMLDivElement>) => {
      if (n === 0) return;
      const caja = evento.currentTarget.getBoundingClientRect();
      const posicion = evento.clientX - caja.left - MARGEN.izquierda;
      const paso = n <= 1 ? anchoTrazo : anchoTrazo / (n - 1);
      const indice = Math.round(posicion / paso);
      setActivo(Math.max(0, Math.min(n - 1, indice)));
    },
    [anchoTrazo, n],
  );

  const ultimo = datos[n - 1];

  if (n === 0 || !ultimo) {
    return (
      <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>
        Todavía no hay meses con movimientos pagados.
      </p>
    );
  }

  const punto = activo === null ? null : datos[activo];

  return (
    <div className={cn(flexible ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-2", className)}>
      <div
        ref={contenedor}
        className={cn("relative w-full touch-none", flexible && "min-h-0 flex-1")}
        style={flexible ? undefined : { height: altura }}
        onPointerMove={alMover}
        onPointerLeave={() => setActivo(null)}
      >
        <svg
          width="100%"
          height={altura}
          role="img"
          aria-label="Flujo mensual de ingresos y egresos"
        >
          {/* Rejilla y eje de valores. */}
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={MARGEN.izquierda}
                x2={MARGEN.izquierda + anchoTrazo}
                y1={y(m)}
                y2={y(m)}
                stroke="var(--linea)"
                strokeWidth={1}
                opacity={m === 0 ? 1 : 0.5}
              />
              <text
                x={MARGEN.izquierda - 8}
                y={y(m)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--color-muted-foreground)"
              >
                {m === 0 ? "0" : formatearDineroCompacto(m, moneda)}
              </text>
            </g>
          ))}

          {/* Lavado del area: la serie al 10 %. */}
          <path
            d={area((p) => p.ingresos)}
            fill={`color-mix(in oklab, ${colorSerie(SERIE_INGRESOS)} 12%, transparent)`}
            stroke="none"
          />
          <path
            d={area((p) => p.egresos)}
            fill={`color-mix(in oklab, ${colorSerie(SERIE_EGRESOS)} 10%, transparent)`}
            stroke="none"
          />

          {/* Mira vertical del mes activo. */}
          {activo !== null ? (
            <line
              x1={x(activo)}
              x2={x(activo)}
              y1={MARGEN.arriba}
              y2={MARGEN.arriba + altoTrazo}
              stroke="var(--neon-borde)"
              strokeWidth={1}
            />
          ) : null}

          <path
            d={linea((p) => p.egresos)}
            fill="none"
            stroke={colorSerie(SERIE_EGRESOS)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={linea((p) => p.ingresos)}
            fill="none"
            stroke={colorSerie(SERIE_INGRESOS)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Marcador final de cada serie, con anillo del color de la superficie. */}
          {[
            { serie: SERIE_EGRESOS, valor: ultimo.egresos },
            { serie: SERIE_INGRESOS, valor: ultimo.ingresos },
          ].map(({ serie, valor }) => (
            <circle
              key={serie}
              cx={x(n - 1)}
              cy={y(valor)}
              r={4}
              fill={colorSerie(serie)}
              stroke="var(--panel)"
              strokeWidth={2}
            />
          ))}

          {/* Puntos del mes activo. */}
          {activo !== null && punto
            ? [
                { serie: SERIE_EGRESOS, valor: punto.egresos },
                { serie: SERIE_INGRESOS, valor: punto.ingresos },
              ].map(({ serie, valor }) => (
                <circle
                  key={`activo-${serie}`}
                  cx={x(activo)}
                  cy={y(valor)}
                  r={4}
                  fill={colorSerie(serie)}
                  stroke="var(--panel)"
                  strokeWidth={2}
                />
              ))
            : null}

          {/* Eje de meses: se rotulan los extremos y el activo. */}
          {datos.map((p, i) => {
            const visible = i === 0 || i === n - 1 || i === activo;
            if (!visible) return null;

            return (
              <text
                key={p.mes}
                x={x(i)}
                y={altura - 8}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--color-muted-foreground)"
              >
                {formatearMesCorto(p.mes)}
              </text>
            );
          })}
        </svg>

        {/* Globo del mes activo. */}
        {activo !== null && punto ? (
          <div
            className="panel pointer-events-none absolute z-10 min-w-40 p-3 text-xs"
            style={{
              left: Math.min(Math.max(x(activo) - 80, 0), Math.max(ancho - 160, 0)),
              top: 0,
            }}
          >
            <p className="etiqueta-dato">{formatearMesCorto(punto.mes)}</p>
            <ul className="mt-2 space-y-1">
              {[
                { etiqueta: "Ingresos", serie: SERIE_INGRESOS, valor: punto.ingresos },
                { etiqueta: "Egresos", serie: SERIE_EGRESOS, valor: punto.egresos },
              ].map(({ etiqueta, serie, valor }) => (
                <li key={etiqueta} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: colorSerie(serie) }}
                    />
                    {etiqueta}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatearDineroCompacto(valor, moneda)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <TablaDeDatos
        titulo="Flujo mensual de ingresos y egresos"
        columnas={["Ingresos", "Egresos"]}
        filas={datos.map((p) => ({
          etiqueta: formatearMesCorto(p.mes),
          valores: [
            formatearDineroCompacto(p.ingresos, moneda),
            formatearDineroCompacto(p.egresos, moneda),
          ],
        }))}
      />
    </div>
  );
}
