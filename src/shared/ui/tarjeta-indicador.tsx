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
export function TarjetaIndicador({
  etiqueta,
  valor,
  detalle,
  tono = "neutro",
  icono,
  estimado,
  pie,
  className,
}: Props) {
  return (
    <div className={cn("panel panel-acento flex flex-col gap-3 p-4", className)}>
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
        <p className={cn("cifra text-2xl", TONO[tono])} title={valor}>
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

      {pie ? <div className="mt-auto">{pie}</div> : null}
    </div>
  );
}
