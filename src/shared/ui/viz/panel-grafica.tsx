import { PanelDatos } from "@/shared/ui/panel-datos";
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

/**
 * Marco de las graficas: es `PanelDatos` mas la leyenda de series.
 *
 * El marco lo comparte con la agenda y con cualquier panel con titulo propio, para
 * que dos paneles vecinos no puedan tener dos tipografias de titulo.
 */
export function PanelGrafica({ titulo, descripcion, leyenda, accion, children, className }: Props) {
  return (
    <PanelDatos
      titulo={titulo}
      descripcion={descripcion}
      accion={accion}
      className={className}
      cintillo={leyenda && leyenda.length > 1 ? <Leyenda series={leyenda} /> : null}
    >
      {children}
    </PanelDatos>
  );
}

/** Identidad de cada serie. Nunca solo el color: siempre color + etiqueta. */
function Leyenda({ series }: { series: Array<{ etiqueta: string; serie: SerieColor }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {series.map(({ etiqueta, serie }) => (
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
