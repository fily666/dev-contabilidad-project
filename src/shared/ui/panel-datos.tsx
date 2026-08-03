import { cn } from "@/shared/utils/cn";

type Props = {
  titulo: string;
  descripcion?: React.ReactNode;
  /** Cifra o insignia a la derecha del título: el resumen del propio panel. */
  aparte?: React.ReactNode;
  /** Control o enlace de la esquina superior derecha. */
  accion?: React.ReactNode;
  /** Fila entre la cabecera y el contenido: leyenda de series, chips, filtros. */
  cintillo?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * Marco único de los paneles de datos: gráficas, agenda y cualquier bloque con
 * título propio.
 *
 * **Es el único marco, y el `Card` de shadcn no se usa para esto.** Dos marcos con
 * la misma superficie y distinta tipografía de título dejan a dos paneles vecinos
 * de la misma fila con dos tamaños, dos paddings y la línea de acento en uno solo.
 * Con un marco solo, añadir un panel nuevo no obliga a elegir entre dos estilos ni
 * a acertar con el que usó la vecina.
 */
export function PanelDatos({
  titulo,
  descripcion,
  aparte,
  accion,
  cintillo,
  children,
  className,
}: Props) {
  return (
    <section className={cn("panel panel-acento flex flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="etiqueta-dato">{titulo}</h3>
          {descripcion ? <p className="mt-1 text-xs text-muted-foreground">{descripcion}</p> : null}
        </div>
        {aparte || accion ? (
          <div className="flex shrink-0 items-center gap-3">
            {aparte}
            {accion}
          </div>
        ) : null}
      </div>

      {cintillo}
      {children}
    </section>
  );
}
