import { cn } from "@/shared/utils/cn";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { brilloSerie, degradadoSerie, type SerieColor } from "./definiciones";
import { marcasDeEje, proporcion } from "./escala";

/**
 * `clave` identifica la fila cuando la etiqueta se repite: dos categorias raiz
 * distintas pueden llamarse igual («Operación» existe en vehiculo y en negocio)
 * y React descartaba una de las dos barras por clave duplicada.
 */
type Fila = { clave?: string; etiqueta: string; valor: number };

type Props = {
  filas: Fila[];
  moneda: string;
  /** Una sola serie: el titulo del panel ya dice que se mide (sin leyenda). */
  serie?: SerieColor;
  /** Cuantas filas se muestran; el resto se agrupa como «Otros». */
  maximoFilas?: number;
  className?: string;
};

/**
 * Barras horizontales ordenadas de mayor a menor, con el valor en la punta.
 * Comparacion de magnitudes entre categorias nominales: todas comparten el
 * mismo tono, porque el largo ya codifica la magnitud.
 */
export function BarrasRanking({ filas, moneda, serie = 1, maximoFilas = 6, className }: Props) {
  const ordenadas = [...filas].sort((a, b) => b.valor - a.valor);
  const visibles = ordenadas.slice(0, maximoFilas);
  const resto = ordenadas.slice(maximoFilas);

  const datos =
    resto.length > 0
      ? [
          ...visibles,
          {
            clave: "otros",
            etiqueta: `Otros (${resto.length})`,
            valor: resto.reduce((a, f) => a + f.valor, 0),
          },
        ]
      : visibles;

  const marcas = marcasDeEje(Math.max(...datos.map((d) => d.valor), 0));
  const techo = marcas[marcas.length - 1] || 1;

  return (
    <ul className={cn("space-y-3", className)}>
      {datos.map(({ clave, etiqueta, valor }) => {
        const texto = formatearDineroCompacto(valor, moneda);

        return (
          <li
            key={clave ?? etiqueta}
            className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3"
          >
            <span className="truncate text-xs text-muted-foreground" title={etiqueta}>
              {etiqueta}
            </span>
            <span
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "var(--linea)" }}
              title={`${etiqueta}: ${texto}`}
            >
              <span
                className="block h-full rounded-r-[4px]"
                style={{
                  width: `${proporcion(valor, techo) * 100}%`,
                  background: degradadoSerie(serie, "derecha"),
                  filter: brilloSerie(serie),
                }}
              />
            </span>
            <span className="text-xs font-medium tabular-nums">{texto}</span>
          </li>
        );
      })}
    </ul>
  );
}
