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
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {icono ? (
        <div className="text-muted-foreground" aria-hidden>
          {icono}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-base font-medium">{titulo}</h3>
        {descripcion ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {accion}
    </div>
  );
}
