import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { InsigniaEstadoFinanciero } from "@/shared/ui/insignias";
import { cn } from "@/shared/utils/cn";
import {
  formatearDineroCompacto,
  formatearFecha,
  formatearPorcentaje,
} from "@/shared/utils/formato";
import type { Semaforo } from "../../application/obtener-semaforos.use-case";
import type { ResumenProyecto } from "../../domain/proyecto.repository";

type Props = {
  proyectos: ResumenProyecto[];
  /** §5.5, por proyecto. Sin entrada, la fila no pinta semáforo. */
  semaforos?: Map<string, Semaforo>;
  /** ROI por proyecto; `null` donde no es calculable (§5.3). */
  roiPorProyecto?: Map<string, number | null>;
  formatoFecha?: string;
};

/**
 * La cartera completa en una tabla (RF-74 + RF-77 fusionados).
 *
 * Antes eran dos componentes distintos con las mismas cuatro columnas: un panel
 * «Rentabilidad por proyecto» que filtraba los proyectos sin ingresos, y una
 * rejilla de tarjetas con invertido, ingresos, egresos y balance. La única
 * diferencia real era el filtro, así que la pantalla mostraba dos veces lo mismo y
 * ninguna de las dos permitía comparar: seis tarjetas no se comparan, y la tabla no
 * traía el resto de la cartera.
 *
 * Aquí van todos los proyectos, con el ROI en «—» donde no es calculable —que es
 * exactamente lo que manda §5.3 y lo que el filtro anterior escondía— y con el
 * semáforo de §5.5 como primera señal: lo que requiere atención se lee antes que
 * cualquier cifra.
 */
export function TablaCartera({ proyectos, semaforos, roiPorProyecto, formatoFecha }: Props) {
  return (
    <>
      {/* Escritorio */}
      <div className="panel hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Invertido</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">Egresos</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {proyectos.map((p) => {
              const roi = roiPorProyecto?.get(p.proyectoId) ?? null;
              const semaforo = semaforos?.get(p.proyectoId);

              return (
                <TableRow key={p.proyectoId}>
                  <TableCell className="max-w-56">
                    <Link
                      href={`/proyectos/${p.proyectoId}`}
                      className="block truncate font-medium hover:text-neon"
                    >
                      {p.nombre}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.tipoNombre}
                      {p.ultimoMovimiento
                        ? ` · último ${formatearFecha(p.ultimoMovimiento, formatoFecha)}`
                        : " · sin movimientos"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {semaforo ? (
                      <InsigniaEstadoFinanciero estado={semaforo.estado} motivo={semaforo.motivo} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearDineroCompacto(p.totalInvertido, p.moneda)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearDineroCompacto(p.totalIngresos, p.moneda)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearDineroCompacto(p.totalEgresos, p.moneda)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      p.balance >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {formatearDineroCompacto(p.balance, p.moneda)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      roi === null
                        ? "text-muted-foreground"
                        : roi >= 0
                          ? "text-success"
                          : "text-destructive",
                    )}
                  >
                    {formatearPorcentaje(roi, 1)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/proyectos/${p.proyectoId}`}
                      aria-label={`Abrir ${p.nombre}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Móvil: la tabla colapsa a tarjetas (RNF-01). */}
      <ul className="space-y-3 md:hidden">
        {proyectos.map((p) => {
          const roi = roiPorProyecto?.get(p.proyectoId) ?? null;
          const semaforo = semaforos?.get(p.proyectoId);

          return (
            <li key={p.proyectoId}>
              <Link href={`/proyectos/${p.proyectoId}`} className="panel panel-enlace block p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="etiqueta-dato">{p.tipoNombre}</p>
                    <p className="truncate font-medium">{p.nombre}</p>
                  </div>
                  {semaforo ? (
                    <InsigniaEstadoFinanciero estado={semaforo.estado} motivo={semaforo.motivo} />
                  ) : null}
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="etiqueta-dato">Invertido</dt>
                    <dd className="tabular-nums">
                      {formatearDineroCompacto(p.totalInvertido, p.moneda)}
                    </dd>
                  </div>
                  <div>
                    <dt className="etiqueta-dato">Balance</dt>
                    <dd
                      className={cn(
                        "font-medium tabular-nums",
                        p.balance >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatearDineroCompacto(p.balance, p.moneda)}
                    </dd>
                  </div>
                  <div>
                    <dt className="etiqueta-dato">ROI</dt>
                    <dd className="tabular-nums">{formatearPorcentaje(roi, 1)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
