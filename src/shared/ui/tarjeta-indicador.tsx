import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/shared/utils/cn";
import { formatearPorcentaje } from "@/shared/utils/formato";

type Props = {
  etiqueta: string;
  valor: string;
  /** Aclaracion breve bajo el valor. */
  detalle?: string;
  /** Tono semantico del valor. */
  tono?: "neutro" | "positivo" | "negativo" | "advertencia";
  icono?: React.ReactNode;
  /** Marca el indicador como estimado (§5.3). */
  estimado?: boolean;
  /**
   * Variacion frente al periodo anterior, en tanto por uno. `null` cuando no es
   * calculable —periodo anterior en cero— y entonces no se dibuja nada: §5.3
   * prohibe el `0 %` de relleno tanto como el `+100 %` sobre una base vacia.
   */
  variacion?: number | null;
  /**
   * Si subir es bueno. En «Total de egresos» no lo es, y pintar de verde un gasto
   * que crece es peor que no pintar nada.
   */
  subirEsBueno?: boolean;
  /** Ranura inferior: medidor, chispa o cualquier apoyo visual. */
  pie?: React.ReactNode;
  className?: string;
};

const TONO: Record<NonNullable<Props["tono"]>, string> = {
  neutro: "text-foreground",
  positivo: "text-success",
  negativo: "text-destructive",
  advertencia: "text-warning",
};

/** Tarjeta de indicador del resumen y del dashboard (RF-70, RF-77). */
/** Flecha y color de una variación, según si crecer es deseable o no. */
function Variacion({ razon, subirEsBueno }: { razon: number; subirEsBueno: boolean }) {
  const plano = Math.abs(razon) < 0.005;
  const Icono = plano ? Minus : razon > 0 ? ArrowUp : ArrowDown;
  const favorable = razon > 0 === subirEsBueno;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        plano ? "text-muted-foreground" : favorable ? "text-success" : "text-destructive",
      )}
    >
      <Icono className="size-3" aria-hidden />
      {formatearPorcentaje(Math.abs(razon), 0)}
    </span>
  );
}

export function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  tono = "neutro",
  icono,
  estimado,
  variacion,
  subirEsBueno = true,
  pie,
  className,
}: Props) {
  return (
    // `data-indicador` es el asidero de los E2E (§8.8): un nombre estable al que
    // agarrarse sin depender de clases de Tailwind ni del orden de las tarjetas.
    <div
      data-indicador={etiqueta}
      className={cn("panel panel-acento flex flex-col gap-3 p-4", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="etiqueta-dato leading-4">{etiqueta}</span>
        {icono ? (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon/15 to-neon-2/15 text-neon"
          >
            {icono}
          </span>
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className={cn("cifra text-2xl", TONO[tono])} title={valor}>
            {valor}
          </p>
          {variacion !== null && variacion !== undefined ? (
            <Variacion razon={variacion} subirEsBueno={subirEsBueno} />
          ) : null}
        </div>
        {detalle || estimado ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {detalle}
            {estimado ? (
              <span className="ml-1 text-warning" title="Menos de 12 meses de historia">
                (estimado)
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {pie ? <div className="mt-auto">{pie}</div> : null}
    </div>
  );
}
