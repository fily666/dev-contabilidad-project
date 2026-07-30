import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowLeftRight, FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
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

export const metadata: Metadata = { title: "Movimientos" };

type Props = { searchParams: Promise<ParametrosBusqueda> };

/** RF-20 a RF-26. */
export default async function PaginaMovimientos({ searchParams }: Props) {
  const parametros = await searchParams;
  const { filtro, orden, pagina, porPagina } = leerFiltros(parametros);
  const { contenedor } = await contenedorPrivado();

  const [resultado, proyectos, categorias, metodosPago] = await Promise.all([
    contenedor.movimientos.listar.ejecutar({
      filtro,
      orden,
      paginacion: { pagina, porPagina },
    }),
    contenedor.proyectos.listar.ejecutar({
      filtro: { estados: ["activo", "pausado"] },
    }),
    contenedor.categorias.listar.ejecutar({}),
    contenedor.metodosPago.listar(),
  ]);

  const moneda = proyectos[0]?.moneda ?? "COP";
  const hoy = contenedor.reloj.hoy();

  const opcionesProyecto = proyectos.map((p) => ({
    id: p.proyectoId,
    nombre: p.nombre,
    moneda: p.moneda,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Ingresos y egresos de todos tus proyectos.
          </p>
        </div>
        <DialogoNuevoMovimiento
          proyectos={opcionesProyecto}
          categorias={categorias}
          metodosPago={metodosPago}
          hoy={hoy}
        />
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="Los movimientos siempre pertenecen a un proyecto. Crea uno para empezar a registrar."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <TarjetaIndicador
              etiqueta="Ingresos del filtro"
              valor={formatearDineroCompacto(resultado.totales.ingresos, moneda)}
              tono="positivo"
            />
            <TarjetaIndicador
              etiqueta="Egresos del filtro"
              valor={formatearDineroCompacto(resultado.totales.egresos, moneda)}
            />
            <TarjetaIndicador
              etiqueta="Del cual es inversión"
              valor={formatearDineroCompacto(resultado.totales.invertido, moneda)}
              detalle="Egresos que capitalizan"
            />
          </div>

          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <FiltrosMovimientos
              proyectos={opcionesProyecto.map((p) => ({ id: p.id, nombre: p.nombre }))}
            />
          </Suspense>

          {resultado.filas.length === 0 ? (
            <EstadoVacio
              icono={<ArrowLeftRight className="size-8" />}
              titulo="Sin movimientos con estos filtros"
              descripcion="Ajusta los filtros o registra un movimiento nuevo."
            />
          ) : (
            <div className="space-y-4">
              <TablaMovimientos filas={resultado.filas} metodosPago={metodosPago} hoy={hoy} />
              <Suspense fallback={null}>
                <Paginacion
                  pagina={resultado.pagina}
                  porPagina={resultado.porPagina}
                  total={resultado.total}
                />
              </Suspense>
            </div>
          )}
        </>
      )}
    </div>
  );
}
