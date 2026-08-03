import { Suspense } from "react";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina, CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
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
      <CabeceraPagina
        ambito="Exportación"
        titulo="Reportes"
        descripcion="Los reportes se construyen con las mismas cifras del panel, así que nunca discrepan."
      />

      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <SelectorReporte
          proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
          consulta={consultaDeExportacion(tipo, filtro)}
          tipo={tipo}
        />
      </Suspense>

      <CabeceraSeccion
        titulo={reporte.titulo}
        descripcion={
          <>
            {reporte.filas.length} fila(s)
            {reporte.filas.length > FILAS_VISIBLES
              ? ` · se previsualizan las primeras ${FILAS_VISIBLES}`
              : ""}
            {reporte.filas.length > MAXIMO_FILAS_EXPORTACION
              ? " · excede el máximo exportable: refina los filtros"
              : ""}
          </>
        }
      />

      {reporte.filas.length === 0 ? (
        <EstadoVacio
          icono={<FileText className="size-8" />}
          titulo="Sin datos con estos filtros"
          descripcion="Ajusta el rango de fechas, el proyecto o el tipo de reporte."
        />
      ) : (
        <>
          {/*
            Los totales, ARRIBA de la tabla.
            Estaban al pie, después de cincuenta filas de previsualización: la
            respuesta detrás de la evidencia. Y el formato lo decidía la vista con
            un umbral —«si pasa de 999 es dinero»—, que convertía un conteo de
            1.200 movimientos en «$ 1.200» y dejaba un importe de 800 sin moneda.
            Ahora cada total trae su tipo desde el dominio (§11).
          */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reporte.totales.map((total) => (
              <TarjetaIndicador
                key={total.etiqueta}
                etiqueta={total.etiqueta}
                valor={
                  total.tipo === "dinero"
                    ? formatearDinero(Number(total.valor), reporte.moneda)
                    : Number(total.valor).toLocaleString("es-CO")
                }
              />
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
