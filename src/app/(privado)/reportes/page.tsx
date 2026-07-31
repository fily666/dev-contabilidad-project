import { Suspense } from "react";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/cn";
import { formatearDinero, formatearFecha } from "@/shared/utils/formato";
import { MAXIMO_FILAS_EXPORTACION } from "@/modules/reportes/domain/reporte";
import { SelectorReporte } from "@/modules/reportes/presentation/components/selector-reporte";
import {
  consultaDeExportacion,
  leerFiltroReporte,
  type ParametrosBusqueda,
} from "@/modules/reportes/presentation/leer-filtros";

export const metadata: Metadata = { title: "Reportes" };

type Props = { searchParams: Promise<ParametrosBusqueda> };

/** Cuántas filas se previsualizan: el archivo lleva todas. */
const FILAS_VISIBLES = 50;

/** RF-90 a RF-95. */
export default async function PaginaReportes({ searchParams }: Props) {
  const parametros = await searchParams;
  const { tipo, filtro } = leerFiltroReporte(parametros);
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyectos = await contenedor.proyectos.listar.ejecutar({});
  const proyecto = filtro.proyectoId
    ? (proyectos.find((p) => p.proyectoId === filtro.proyectoId) ?? null)
    : null;

  const reporte = await contenedor.reportes[tipo].ejecutar({
    filtro: { ...filtro, proyectoNombre: proyecto?.nombre ?? null },
  });

  const visibles = reporte.filas.slice(0, FILAS_VISIBLES);

  function celda(valor: string | number | null, tipoColumna: string): string {
    if (valor === null || valor === "") return "—";
    if (typeof valor === "number") {
      if (tipoColumna === "dinero") return formatearDinero(valor, reporte.moneda);
      if (tipoColumna === "porcentaje") return `${(valor * 100).toFixed(1)} %`;
      return valor.toLocaleString("es-CO");
    }
    if (tipoColumna === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return formatearFecha(valor, ajustes.formatoFecha);
    }
    return valor;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta-dato">Exportación</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Los reportes se construyen con las mismas cifras del dashboard, así que nunca discrepan.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <SelectorReporte
          proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
          consulta={consultaDeExportacion(tipo, filtro)}
          tipo={tipo}
        />
      </Suspense>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">{reporte.titulo}</h2>
        <p className="text-xs text-muted-foreground">
          {reporte.filas.length} fila(s)
          {reporte.filas.length > FILAS_VISIBLES
            ? ` · se previsualizan las primeras ${FILAS_VISIBLES}`
            : ""}
          {reporte.filas.length > MAXIMO_FILAS_EXPORTACION
            ? " · excede el máximo exportable: refina los filtros"
            : ""}
        </p>
      </div>

      {reporte.filas.length === 0 ? (
        <EstadoVacio
          icono={<FileText className="size-8" />}
          titulo="Sin datos con estos filtros"
          descripcion="Ajusta el rango de fechas, el proyecto o el tipo de reporte."
        />
      ) : (
        <>
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {reporte.columnas.map((columna) => (
                    <TableHead
                      key={columna.clave}
                      className={cn(
                        (columna.tipo === "dinero" || columna.tipo === "numero") && "text-right",
                      )}
                    >
                      {columna.etiqueta}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((fila, indice) => (
                  <TableRow key={indice}>
                    {reporte.columnas.map((columna) => (
                      <TableCell
                        key={columna.clave}
                        className={cn(
                          (columna.tipo === "dinero" || columna.tipo === "numero") &&
                            "text-right tabular-nums",
                        )}
                      >
                        {celda(fila[columna.clave] ?? null, columna.tipo)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <dl className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {reporte.totales.map((total) => (
              <div key={total.etiqueta}>
                <dt className="etiqueta-dato">{total.etiqueta}</dt>
                <dd className="cifra mt-1 text-lg">
                  {Number.isFinite(Number(total.valor)) && Number(total.valor) > 999
                    ? formatearDinero(Number(total.valor), reporte.moneda)
                    : total.valor}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
