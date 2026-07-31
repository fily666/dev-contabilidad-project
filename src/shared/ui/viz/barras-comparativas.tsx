import { cn } from "@/shared/utils/cn";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { brilloSerie, degradadoSerie, type SerieColor } from "./definiciones";
import { marcasDeEje, proporcion } from "./escala";
import { TablaDeDatos } from "./panel-grafica";

type Serie = { etiqueta: string; serie: SerieColor };
/** `clave` identifica la categoria cuando dos etiquetas coinciden (ver `BarrasRanking`). */
type Categoria = { clave?: string; etiqueta: string; valores: number[] };

type Props = {
  categorias: Categoria[];
  /** Dos o tres series como maximo: mas de eso se lee mejor en varias graficas. */
  series: Serie[];
  moneda: string;
  /** Titulo de la vista de tabla equivalente (accesibilidad). */
  tituloTabla: string;
  altura?: number;
  className?: string;
};

/**
 * Columnas agrupadas: compara pocas series entre categorias nominales.
 * Un solo eje —nunca dos escalas—, rejilla en hairline y separacion de 2 px
 * entre columnas vecinas para que el color no tenga que hacer ese trabajo.
 */
export function BarrasComparativas({
  categorias,
  series,
  moneda,
  tituloTabla,
  altura = 208,
  className,
}: Props) {
  const todos = categorias.flatMap((c) => c.valores);
  const marcas = marcasDeEje(Math.max(...todos, 0));
  const techo = marcas[marcas.length - 1] || 1;
  const maximo = Math.max(...todos, 0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-3">
        {/* Eje de valores: numeros redondeados, de arriba hacia abajo. */}
        <div
          aria-hidden
          className="flex shrink-0 flex-col justify-between text-right"
          style={{ height: altura }}
        >
          {[...marcas].reverse().map((m) => (
            <span
              key={m}
              className="font-mono text-[0.63rem] leading-none text-muted-foreground tabular-nums"
            >
              {m === 0 ? "0" : formatearDineroCompacto(m, moneda)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: altura }}>
            {marcas.map((m) => (
              <span
                key={m}
                aria-hidden
                className="absolute inset-x-0 h-px"
                style={{
                  bottom: `${proporcion(m, techo) * 100}%`,
                  background: "var(--linea)",
                  opacity: m === 0 ? 1 : 0.5,
                }}
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-4">
              {categorias.map((categoria) => (
                <div
                  key={categoria.clave ?? categoria.etiqueta}
                  // El area de la categoria completa tambien responde al puntero,
                  // para no obligar a acertar sobre una columna de 16 px.
                  title={`${categoria.etiqueta}\n${series
                    .map(
                      (s, i) =>
                        `${s.etiqueta}: ${formatearDineroCompacto(categoria.valores[i] ?? 0, moneda)}`,
                    )
                    .join("\n")}`}
                  className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5"
                >
                  {categoria.valores.map((valor, i) => {
                    const s = series[i];
                    if (!s) return null;
                    const texto = formatearDineroCompacto(valor, moneda);
                    const alto = proporcion(valor, techo);
                    // Se rotula solo la columna mas alta, y solo si el texto cabe
                    // sobre la marca: si no cabe, lo cargan el globo y la tabla.
                    const esMaximo = valor === maximo && maximo > 0 && alto <= 0.9;

                    return (
                      <div
                        key={s.etiqueta}
                        className="relative flex h-full w-4 items-end justify-center"
                        title={`${categoria.etiqueta} · ${s.etiqueta}: ${texto}`}
                      >
                        {esMaximo ? (
                          <span
                            className="absolute left-1/2 -translate-x-1/2 font-mono text-[0.63rem] whitespace-nowrap text-muted-foreground tabular-nums"
                            style={{ bottom: `calc(${alto * 100}% + 6px)` }}
                          >
                            {texto}
                          </span>
                        ) : null}
                        <span
                          className="block w-full rounded-t-[4px]"
                          style={{
                            height: `${alto * 100}%`,
                            minHeight: valor > 0 ? 2 : 0,
                            background: degradadoSerie(s.serie, "arriba"),
                            filter: brilloSerie(s.serie),
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 flex gap-4">
            {categorias.map((categoria) => (
              <span
                key={categoria.clave ?? categoria.etiqueta}
                title={categoria.etiqueta}
                className="min-w-0 flex-1 truncate text-center text-[0.65rem] text-muted-foreground"
              >
                {categoria.etiqueta}
              </span>
            ))}
          </div>
        </div>
      </div>

      <TablaDeDatos
        titulo={tituloTabla}
        columnas={series.map((s) => s.etiqueta)}
        filas={categorias.map((c) => ({
          clave: c.clave,
          etiqueta: c.etiqueta,
          valores: c.valores.map((v) => formatearDineroCompacto(v, moneda)),
        }))}
      />
    </div>
  );
}
