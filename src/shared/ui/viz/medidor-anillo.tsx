import { cn } from "@/shared/utils/cn";
import { brilloSerie, colorSerie, type SerieColor } from "./definiciones";

const RADIO = 46;
const GROSOR = 7;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

type PropsAnillo = {
  etiqueta: string;
  /** Proporcion 0..1 dibujada en el arco. `null` cuando no es calculable. */
  razon: number | null;
  /** Texto del centro: el valor real, no el arco. */
  valorTexto: string;
  detalle?: string;
  serie?: SerieColor;
  className?: string;
};

/**
 * Medidor de anillo: una sola magnitud acotada. El valor va escrito en el
 * centro, asi que el arco es apoyo visual y no el unico portador del dato.
 */
export function MedidorAnillo({
  etiqueta,
  razon,
  valorTexto,
  detalle,
  serie = 1,
  className,
}: PropsAnillo) {
  const arco = razon === null ? 0 : CIRCUNFERENCIA * Math.max(0, Math.min(1, razon));

  return (
    <figure className={cn("flex flex-col items-center gap-2 text-center", className)}>
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img">
          <title>{`${etiqueta}: ${valorTexto}`}</title>
          <circle
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            stroke="var(--linea)"
            strokeWidth={GROSOR}
          />
          {arco > 0 ? (
            <circle
              cx="50"
              cy="50"
              r={RADIO}
              fill="none"
              stroke={`url(#deg-${serie}-h)`}
              strokeWidth={GROSOR}
              strokeLinecap="round"
              strokeDasharray={`${arco} ${CIRCUNFERENCIA}`}
              style={{ filter: brilloSerie(serie) }}
            />
          ) : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-3">
          <span className="cifra text-lg" title={valorTexto}>
            {valorTexto}
          </span>
        </div>
      </div>

      <figcaption className="space-y-0.5">
        <span className="etiqueta-dato block">{etiqueta}</span>
        {detalle ? <span className="block text-xs text-muted-foreground">{detalle}</span> : null}
      </figcaption>
    </figure>
  );
}

type PropsConcentricos = {
  /** Hasta tres series; se dibujan de fuera hacia dentro. */
  series: Array<{ etiqueta: string; razon: number | null; valorTexto: string; serie: SerieColor }>;
  /** Cifra del centro (el total que reparten los anillos). */
  totalTexto: string;
  totalEtiqueta: string;
  className?: string;
};

/**
 * Anillos concentricos: reparto de un total entre pocas categorias. Cada anillo
 * lleva su entrada en la leyenda con el valor escrito.
 */
export function AnillosConcentricos({
  series,
  totalTexto,
  totalEtiqueta,
  className,
}: PropsConcentricos) {
  const radios = [46, 36, 26] as const;

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img">
          <title>{`${totalEtiqueta}: ${totalTexto}`}</title>
          {series.slice(0, 3).map(({ etiqueta, razon, valorTexto, serie }, i) => {
            const radio = radios[i] ?? radios[2];
            const circunferencia = 2 * Math.PI * radio;
            const arco = razon === null ? 0 : circunferencia * Math.max(0, Math.min(1, razon));

            return (
              <g key={etiqueta}>
                <circle
                  cx="50"
                  cy="50"
                  r={radio}
                  fill="none"
                  stroke="var(--linea)"
                  strokeWidth={6}
                />
                {arco > 0 ? (
                  <circle
                    cx="50"
                    cy="50"
                    r={radio}
                    fill="none"
                    stroke={`url(#deg-${serie}-h)`}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={`${arco} ${circunferencia}`}
                    style={{ filter: brilloSerie(serie) }}
                  >
                    <title>{`${etiqueta}: ${valorTexto}`}</title>
                  </circle>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="cifra text-base" title={totalTexto}>
            {totalTexto}
          </span>
          <span className="etiqueta-dato mt-0.5 text-[0.6rem]">{totalEtiqueta}</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2.5">
        {series.slice(0, 3).map(({ etiqueta, valorTexto, serie }) => (
          <li key={etiqueta} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: colorSerie(serie) }}
              />
              <span className="truncate text-muted-foreground">{etiqueta}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{valorTexto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
