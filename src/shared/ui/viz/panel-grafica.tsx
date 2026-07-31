import { cn } from "@/shared/utils/cn";
import { colorSerie, type SerieColor } from "./definiciones";

type Props = {
  titulo: string;
  descripcion?: string;
  /** Leyenda: obligatoria desde dos series (la identidad nunca es solo el color). */
  leyenda?: Array<{ etiqueta: string; serie: SerieColor }>;
  accion?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Marco comun de las graficas: titulo, leyenda y superficie. */
export function PanelGrafica({ titulo, descripcion, leyenda, accion, children, className }: Props) {
  return (
    <section className={cn("panel panel-acento flex flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="etiqueta-dato">{titulo}</h3>
          {descripcion ? <p className="mt-1 text-xs text-muted-foreground">{descripcion}</p> : null}
        </div>
        {accion}
      </div>

      {leyenda && leyenda.length > 1 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {leyenda.map(({ etiqueta, serie }) => (
            <li key={etiqueta} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: colorSerie(serie) }}
              />
              {etiqueta}
            </li>
          ))}
        </ul>
      ) : null}

      {children}
    </section>
  );
}

/**
 * Vista de tabla de una grafica. Se mantiene accesible al lector de pantalla y
 * garantiza que ningun valor quede solo en el color o en el tamaño de la marca.
 */
export function TablaDeDatos({
  titulo,
  columnas,
  filas,
}: {
  titulo: string;
  columnas: string[];
  /** `clave` identifica la fila cuando dos etiquetas coinciden (ver `BarrasRanking`). */
  filas: Array<{ clave?: string; etiqueta: string; valores: string[] }>;
}) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <thead>
        <tr>
          <th scope="col">Concepto</th>
          {columnas.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.clave ?? f.etiqueta}>
            <th scope="row">{f.etiqueta}</th>
            {f.valores.map((v, i) => (
              <td key={`${f.clave ?? f.etiqueta}-${columnas[i] ?? i}`}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
