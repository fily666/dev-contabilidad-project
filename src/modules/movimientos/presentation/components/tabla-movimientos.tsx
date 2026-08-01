import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { InsigniaEstadoMovimiento, InsigniaNaturaleza } from "@/shared/ui/insignias";
import { formatearDinero, formatearFecha } from "@/shared/utils/formato";
import { cn } from "@/shared/utils/cn";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import type { MovimientoListado } from "../../domain/movimiento.repository";
import { AccionesMovimiento } from "./acciones-movimiento";
import { CabeceraOrden } from "./cabecera-orden";

type Props = {
  filas: MovimientoListado[];
  metodosPago: MetodoPagoVista[];
  hoy: string;
  /** Patron de fecha elegido en los ajustes (RF-101). */
  formatoFecha?: string;
  /** Oculta la columna de proyecto cuando ya se esta dentro de uno. */
  ocultarProyecto?: boolean;
  /**
   * RF-24: cabeceras pulsables. Se apaga donde el listado no es la vista
   * principal —los últimos movimientos del detalle de proyecto—, porque ahí el
   * orden lo fija la página y un control que no hace nada es peor que ninguno.
   */
  ordenable?: boolean;
};

/** RF-23, RF-24. En móvil la tabla se presenta como tarjetas (RNF-01). */
export function TablaMovimientos({
  filas,
  metodosPago,
  hoy,
  formatoFecha,
  ocultarProyecto,
  ordenable,
}: Props) {
  return (
    <>
      {/* Escritorio */}
      <div className="panel hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">
                {ordenable ? <CabeceraOrden campo="fecha">Fecha</CabeceraOrden> : "Fecha"}
              </TableHead>
              {ocultarProyecto ? null : <TableHead>Proyecto</TableHead>}
              <TableHead>Descripción</TableHead>
              <TableHead>
                {ordenable ? (
                  <CabeceraOrden campo="categoria">Categoría</CabeceraOrden>
                ) : (
                  "Categoría"
                )}
              </TableHead>
              <TableHead>Naturaleza</TableHead>
              <TableHead className="text-right">
                {ordenable ? (
                  <CabeceraOrden campo="valor" alineado="derecha">
                    Valor
                  </CabeceraOrden>
                ) : (
                  "Valor"
                )}
              </TableHead>
              <TableHead>
                {ordenable ? <CabeceraOrden campo="estado">Estado</CabeceraOrden> : "Estado"}
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={fila.id} className={cn(fila.estado === "anulado" && "opacity-60")}>
                <TableCell className="tabular-nums">
                  {formatearFecha(fila.fecha, formatoFecha)}
                </TableCell>
                {ocultarProyecto ? null : (
                  <TableCell className="max-w-40 truncate">{fila.proyectoNombre}</TableCell>
                )}
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">{fila.descripcion}</p>
                  {fila.metodoPago ? (
                    <p className="text-xs text-muted-foreground">{fila.metodoPago}</p>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-52 truncate text-sm text-muted-foreground">
                  {fila.categoriaRuta}
                </TableCell>
                <TableCell>
                  <InsigniaNaturaleza naturaleza={fila.naturaleza} />
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    fila.tipo === "ingreso" ? "text-success" : "text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {fila.tipo === "ingreso" ? (
                      <ArrowUpRight className="size-3.5" aria-label="Ingreso" />
                    ) : (
                      <ArrowDownRight className="size-3.5" aria-label="Egreso" />
                    )}
                    {formatearDinero(fila.valor, fila.moneda)}
                  </span>
                </TableCell>
                <TableCell>
                  <InsigniaEstadoMovimiento estado={fila.estadoEfectivo} />
                </TableCell>
                <TableCell>
                  <AccionesMovimiento
                    id={fila.id}
                    estado={fila.estado}
                    metodosPago={metodosPago}
                    hoy={hoy}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Móvil */}
      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.id} className={cn("panel p-4", fila.estado === "anulado" && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{fila.descripcion}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ocultarProyecto
                    ? fila.categoriaRuta
                    : `${fila.proyectoNombre} · ${fila.categoriaRuta}`}
                </p>
              </div>
              <AccionesMovimiento
                id={fila.id}
                estado={fila.estado}
                metodosPago={metodosPago}
                hoy={hoy}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatearFecha(fila.fecha, formatoFecha)}
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  fila.tipo === "ingreso" ? "text-success" : "text-foreground",
                )}
              >
                {fila.tipo === "ingreso" ? "+" : "−"} {formatearDinero(fila.valor, fila.moneda)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <InsigniaEstadoMovimiento estado={fila.estadoEfectivo} />
              <InsigniaNaturaleza naturaleza={fila.naturaleza} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
