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
 * Antes había dos marcos compitiendo en la misma fila del panel general:
 * `PanelGrafica` (superficie `panel panel-acento`, título en versalitas mono de
 * 0,7 rem) y `Card` de shadcn (misma superficie, sin la línea de acento, título en
 * `font-heading` de 1 rem con capitalización normal). «Flujo de caja ejecutado» y
 * «Requiere atención» quedaban lado a lado con dos tipografías, dos tamaños y dos
 * paddings —20 px contra 20 px verticales pero repartidos distinto—, y el borde
 * superior luminoso aparecía en uno y no en el otro.
 *
 * Con un marco solo, añadir un panel nuevo no obliga a elegir entre dos estilos ni
 * a acertar con el que la vecina usó.
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
