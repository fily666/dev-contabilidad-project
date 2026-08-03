import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/shared/utils/cn";
import { CLASES_ESTADO_EVENTO, LEYENDA_ESTADOS } from "../estilos-evento";

/**
 * Clave de lectura de la rejilla (RF-61).
 *
 * Sustituye al párrafo que había al final de la página: nombraba los colores por
 * escrito, iba **debajo** de la rejilla que explicaba —o sea, después de haberla
 * leído a ciegas— y se pintaba también cuando el mes estaba vacío. Aquí las
 * muestras son el mismo estilo que pinta cada chip, así que no pueden discrepar de
 * él.
 */
export function LeyendaCalendario() {
  return (
    <ul
      aria-label="Clave de colores del calendario"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
    >
      {LEYENDA_ESTADOS.map(({ estado, etiqueta }) => (
        <li key={estado} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("size-3 rounded-sm border", CLASES_ESTADO_EVENTO[estado])}
          />
          {etiqueta}
        </li>
      ))}

      <li className="flex items-center gap-1.5">
        <ArrowUpRight className="size-3.5" aria-hidden /> Ingreso
      </li>
      <li className="flex items-center gap-1.5">
        <ArrowDownRight className="size-3.5" aria-hidden /> Egreso
      </li>
    </ul>
  );
}
