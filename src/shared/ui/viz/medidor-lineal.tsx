import { cn } from "@/shared/utils/cn";
import { brilloSerie, degradadoSerie, type SerieColor } from "./definiciones";

type Props = {
  etiqueta: string;
  /** Proporcion 0..1. `null` cuando no es calculable. */
  razon: number | null;
  /** Valor escrito a la derecha de la etiqueta. */
  valorTexto?: string;
  serie?: SerieColor;
  className?: string;
};

/**
 * Medidor lineal: una proporcion sobre una pista del mismo tono, un paso mas
 * cerca de la superficie, para que el estado se lea en toda la barra.
 */
export function MedidorLineal({ etiqueta, razon, valorTexto, serie = 1, className }: Props) {
  const relleno = razon === null ? 0 : Math.max(0, Math.min(1, razon));

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="etiqueta-dato truncate">{etiqueta}</span>
        {valorTexto ? (
          <span className="shrink-0 text-xs font-medium tabular-nums">{valorTexto}</span>
        ) : null}
      </div>

      <div
        role="img"
        aria-label={`${etiqueta}${valorTexto ? `: ${valorTexto}` : ""}`}
        title={`${etiqueta}${valorTexto ? `: ${valorTexto}` : ""}`}
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--linea)" }}
      >
        <div
          className="h-full rounded-r-[4px] transition-[width] duration-500"
          style={{
            width: `${relleno * 100}%`,
            background: degradadoSerie(serie, "derecha"),
            filter: brilloSerie(serie),
          }}
        />
      </div>
    </div>
  );
}
