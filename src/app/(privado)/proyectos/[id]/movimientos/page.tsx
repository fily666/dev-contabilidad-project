import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";

import { contenedorAutenticado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { DialogoNuevoMovimiento } from "@/modules/movimientos/presentation/components/dialogo-nuevo-movimiento";
import { FiltrosMovimientos } from "@/modules/movimientos/presentation/components/filtros-movimientos";
import { Paginacion } from "@/modules/movimientos/presentation/components/paginacion";
import { TablaMovimientos } from "@/modules/movimientos/presentation/components/tabla-movimientos";
import {
  leerFiltros,
  type ParametrosBusqueda,
} from "@/modules/movimientos/presentation/leer-filtros";

export const metadata: Metadata = { title: "Movimientos del proyecto" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<ParametrosBusqueda>;
};

export default async function PaginaMovimientosProyecto({ params, searchParams }: Props) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);
  const { filtro, orden, pagina, porPagina } = leerFiltros(parametros);
  const { contenedor, sesion } = await contenedorAutenticado();

  const proyecto = await contenedor.proyectos.repositorio.buscarPorId(id, sesion.usuarioId);
  if (!proyecto) notFound();

  const [resultado, categorias, metodosPago] = await Promise.all([
    contenedor.movimientos.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      // El proyecto de la ruta manda sobre cualquier parametro de la URL.
      filtro: { ...filtro, proyectoId: id },
      orden,
      paginacion: { pagina, porPagina },
    }),
    contenedor.categorias.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      filtro: { tipoProyectoId: proyecto.tipoProyectoId },
    }),
    contenedor.metodosPago.listar(sesion.usuarioId),
  ]);

  const hoy = contenedor.reloj.hoy();

  return (
    <div className="space-y-6">
      <div>
        <EnlaceBoton href={`/proyectos/${id}`} variant="ghost" size="sm" className="mb-2 -ml-2">
          <ArrowLeft className="size-4" aria-hidden /> {proyecto.nombre}
        </EnlaceBoton>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
          <DialogoNuevoMovimiento
            proyectos={[{ id: proyecto.id, nombre: proyecto.nombre, moneda: proyecto.moneda }]}
            categorias={categorias}
            metodosPago={metodosPago}
            hoy={hoy}
            proyectoFijo={proyecto.id}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TarjetaIndicador
          etiqueta="Ingresos del filtro"
          valor={formatearDineroCompacto(resultado.totales.ingresos, proyecto.moneda)}
          tono="positivo"
        />
        <TarjetaIndicador
          etiqueta="Egresos del filtro"
          valor={formatearDineroCompacto(resultado.totales.egresos, proyecto.moneda)}
        />
        <TarjetaIndicador
          etiqueta="Del cual es inversión"
          valor={formatearDineroCompacto(resultado.totales.invertido, proyecto.moneda)}
          detalle="Egresos que capitalizan"
        />
      </div>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <FiltrosMovimientos proyectos={[]} ocultarProyecto />
      </Suspense>

      {resultado.filas.length === 0 ? (
        <EstadoVacio
          icono={<ArrowLeftRight className="size-8" />}
          titulo="Sin movimientos con estos filtros"
          descripcion="Ajusta los filtros o registra un movimiento nuevo."
        />
      ) : (
        <div className="space-y-4">
          <TablaMovimientos
            filas={resultado.filas}
            metodosPago={metodosPago}
            hoy={hoy}
            ocultarProyecto
          />
          <Suspense fallback={null}>
            <Paginacion
              pagina={resultado.pagina}
              porPagina={resultado.porPagina}
              total={resultado.total}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
