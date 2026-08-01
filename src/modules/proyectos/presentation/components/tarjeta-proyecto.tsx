import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InsigniaEstadoFinanciero, InsigniaEstadoProyecto } from "@/shared/ui/insignias";
import {
  formatearDineroCompacto,
  formatearFecha,
  formatearPorcentaje,
} from "@/shared/utils/formato";
import { MedidorLineal } from "@/shared/ui/viz/medidor-lineal";
import { razonAcotada } from "@/shared/ui/viz/escala";
import { cn } from "@/shared/utils/cn";
import type { Semaforo } from "../../application/obtener-semaforos.use-case";
import type { ResumenProyecto } from "../../domain/proyecto.repository";

/** RF-77: resumen financiero por proyecto en el listado. */
export function TarjetaProyecto({
  proyecto,
  semaforo,
  roi,
  formatoFecha,
}: {
  proyecto: ResumenProyecto;
  /** §5.5: la señal va antes que la cifra. Sin ella no se pinta nada. */
  semaforo?: Semaforo;
  /** ROI acumulado; `null` cuando no es calculable (§5.3). */
  roi?: number | null;
  /** Patron de fecha elegido en los ajustes (RF-101). */
  formatoFecha?: string;
}) {
  const balancePositivo = proyecto.balance >= 0;

  return (
    // `min-w-0` no es decorativo: como item de grid, la tarjeta tiene
    // `min-width: auto`, asi que el titulo en `white-space: nowrap` fijaba su
    // ancho minimo al del texto completo y estiraba la columna. A 375 px eso
    // daba scroll horizontal a toda la pagina, contra RNF-01.
    <Link
      href={`/proyectos/${proyecto.proyectoId}`}
      className="panel panel-enlace group block min-w-0 p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="etiqueta-dato">{proyecto.tipoNombre}</p>
          <h3 className="mt-1 truncate text-base font-semibold">{proyecto.nombre}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <InsigniaEstadoProyecto estado={proyecto.estado} />
          {semaforo ? (
            <InsigniaEstadoFinanciero estado={semaforo.estado} motivo={semaforo.motivo} />
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="etiqueta-dato">Invertido</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {formatearDineroCompacto(proyecto.totalInvertido, proyecto.moneda)}
          </dd>
        </div>
        <div>
          <dt className="etiqueta-dato">Ingresos</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {formatearDineroCompacto(proyecto.totalIngresos, proyecto.moneda)}
          </dd>
        </div>
        <div>
          <dt className="etiqueta-dato">ROI</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatearPorcentaje(roi ?? null, 1)}</dd>
        </div>
        <div>
          <dt className="etiqueta-dato">Balance</dt>
          <dd
            className={cn(
              "mt-0.5 font-medium tabular-nums",
              balancePositivo ? "text-success" : "text-destructive",
            )}
          >
            {formatearDineroCompacto(proyecto.balance, proyecto.moneda)}
          </dd>
        </div>
      </dl>

      <MedidorLineal
        className="mt-4"
        etiqueta="Cobertura de egresos"
        razon={razonAcotada(proyecto.totalIngresos, proyecto.totalEgresos)}
        valorTexto={formatearPorcentaje(
          proyecto.totalEgresos > 0 ? proyecto.totalIngresos / proyecto.totalEgresos : null,
          0,
        )}
        serie={1}
      />

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {proyecto.ultimoMovimiento
            ? `Último movimiento: ${formatearFecha(proyecto.ultimoMovimiento, formatoFecha)}`
            : "Sin movimientos registrados"}
        </span>
        <ArrowRight
          className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}
