import { cn } from "@/shared/utils/cn";

type Props = {
  titulo: string;
  descripcion?: string;
  icono?: React.ReactNode;
  accion?: React.ReactNode;
  /**
   * Variante para usar DENTRO de un panel o una tarjeta, en lugar de como
   * contenido de la vista entera.
   *
   * La versión de página reserva 16 unidades de alto arriba y abajo, que es lo
   * correcto cuando el estado vacío *es* la pantalla. Metida dentro de un panel de
   * gráfica producía un bloque de unos 320 px para decir «sin datos» —más alto que
   * la propia gráfica que sustituye—, y con cuatro paneles vacíos el dashboard se
   * convertía en una columna de huecos. La densa ocupa aproximadamente un tercio.
   */
  denso?: boolean;
  className?: string;
};

/** Estado vacio con accion sugerida (RNF-12). */
export function EstadoVacio({ titulo, descripcion, icono, accion, denso, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-panel-alto/30 text-center",
        denso ? "gap-2 px-4 py-6" : "gap-4 px-6 py-16",
        className,
      )}
    >
      {icono ? (
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-2xl bg-gradient-to-br from-neon/15 to-neon-2/15 text-neon",
            denso ? "size-9" : "size-14",
          )}
        >
          {icono}
        </div>
      ) : null}
      <div className={denso ? "space-y-0.5" : "space-y-1.5"}>
        <h3 className={cn("font-medium", denso ? "text-sm" : "text-base")}>{titulo}</h3>
        {descripcion ? (
          <p
            className={cn(
              "mx-auto text-muted-foreground",
              denso ? "max-w-xs text-xs" : "max-w-md text-sm",
            )}
          >
            {descripcion}
          </p>
        ) : null}
      </div>
      {accion}
    </div>
  );
}
