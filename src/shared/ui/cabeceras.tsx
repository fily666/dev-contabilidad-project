import { cn } from "@/shared/utils/cn";

/**
 * Las dos cabeceras del producto: la de página (`h1`) y la de sección (`h2`).
 *
 * Existían escritas a mano en las quince páginas y en seis componentes, con dos
 * gramáticas distintas para el mismo nivel:
 *
 * - El bloque `etiqueta-dato` + `h1` + descripción estaba copiado literalmente en
 *   cada `page.tsx`, unas veces suelto y otras dentro de un `flex justify-between`
 *   para colgarle acciones. Cuatro sitios olvidaban el `max-w` de la descripción,
 *   así que en pantalla ancha esa línea llegaba a los 1.400 px: ilegible por
 *   longitud de renglón, no por tamaño.
 * - Los `h2` se repartían entre `etiqueta-dato` (versalitas mono, el resto del
 *   tablero) y `text-lg font-medium` (Patrimonio, Reportes, los documentos del
 *   proyecto y los dos gestores de Patrimonio). Dos jerarquías visuales para el
 *   mismo nivel semántico dentro de la misma pantalla.
 *
 * Una sola definición aquí es lo que hace que el espaciado, el ancho de línea y el
 * peso tipográfico no puedan volver a divergir vista por vista.
 */

type PropsPagina = {
  /** Módulo al que pertenece la vista, en versalitas sobre el título. */
  ambito?: string;
  titulo: string;
  descripcion?: React.ReactNode;
  /** Botones o controles de la vista, alineados a la derecha del título. */
  acciones?: React.ReactNode;
  className?: string;
};

export function CabeceraPagina({ ambito, titulo, descripcion, acciones, className }: PropsPagina) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {ambito ? <p className="etiqueta-dato">{ambito}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}

type PropsSeccion = {
  titulo: string;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
};

export function CabeceraSeccion({ titulo, descripcion, acciones, className }: PropsSeccion) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="etiqueta-dato">{titulo}</h2>
        {descripcion ? (
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
