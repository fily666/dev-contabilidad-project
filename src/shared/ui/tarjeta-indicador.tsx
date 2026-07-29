import { cn } from "@/shared/utils/cn";

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
  className?: string;
};

const TONO: Record<NonNullable<Props["tono"]>, string> = {
  neutro: "text-foreground",
  positivo: "text-success",
  negativo: "text-destructive",
  advertencia: "text-warning",
};

/** Tarjeta de indicador del resumen y del dashboard (RF-70, RF-77). */
export function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  tono = "neutro",
  icono,
  estimado,
  className,
}: Props) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span className="truncate">{etiqueta}</span>
        {icono ? (
          <span aria-hidden className="shrink-0 opacity-60">
            {icono}
          </span>
        ) : null}
      </div>
      <p
        className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", TONO[tono])}
        title={valor}
      >
        {valor}
      </p>
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
  );
}
