import { cn } from "@/shared/utils/cn";

type Props = {
  titulo: string;
  descripcion?: string;
  icono?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
};

/** Estado vacio con accion sugerida (RNF-12). */
export function EstadoVacio({ titulo, descripcion, icono, accion, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/80 bg-panel-alto/30 px-6 py-16 text-center",
        className,
      )}
    >
      {icono ? (
        <div
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon/15 to-neon-2/15 text-neon"
        >
          {icono}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <h3 className="text-base font-medium">{titulo}</h3>
        {descripcion ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {accion}
    </div>
  );
}
