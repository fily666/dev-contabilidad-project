import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InsigniaEstadoProyecto } from "@/shared/ui/insignias";
import { formatearDineroCompacto, formatearFecha } from "@/shared/utils/formato";
import { cn } from "@/shared/utils/cn";
import type { ResumenProyecto } from "../../domain/proyecto.repository";

/** RF-77: resumen financiero por proyecto en el listado. */
export function TarjetaProyecto({ proyecto }: { proyecto: ResumenProyecto }) {
  const balancePositivo = proyecto.balance >= 0;

  return (
    <Link
      href={`/proyectos/${proyecto.proyectoId}`}
      className="group block rounded-lg border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{proyecto.tipoNombre}</p>
          <h3 className="truncate text-base font-semibold">{proyecto.nombre}</h3>
        </div>
        <InsigniaEstadoProyecto estado={proyecto.estado} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Invertido</dt>
          <dd className="font-medium tabular-nums">
            {formatearDineroCompacto(proyecto.totalInvertido, proyecto.moneda)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ingresos</dt>
          <dd className="font-medium tabular-nums">
            {formatearDineroCompacto(proyecto.totalIngresos, proyecto.moneda)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Egresos</dt>
          <dd className="font-medium tabular-nums">
            {formatearDineroCompacto(proyecto.totalEgresos, proyecto.moneda)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Balance</dt>
          <dd
            className={cn(
              "font-medium tabular-nums",
              balancePositivo ? "text-success" : "text-destructive",
            )}
          >
            {formatearDineroCompacto(proyecto.balance, proyecto.moneda)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {proyecto.ultimoMovimiento
            ? `Último movimiento: ${formatearFecha(proyecto.ultimoMovimiento)}`
            : "Sin movimientos registrados"}
        </span>
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}
