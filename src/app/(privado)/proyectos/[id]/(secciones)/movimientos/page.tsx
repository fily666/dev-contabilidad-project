import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Landmark, Scale } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
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
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyecto = await contenedor.proyectos.obtener.buscar({ id });
  if (!proyecto) notFound();

  // El catálogo de categorías lo carga el layout para el diálogo de alta, que
  // ahora vive en la cabecera compartida: esta página ya no lo necesita.
  const [resultado, metodosPago, categorias] = await Promise.all([
    contenedor.movimientos.listar.ejecutar({
      // El proyecto de la ruta manda sobre cualquier parametro de la URL.
      filtro: { ...filtro, proyectoId: id },
      orden,
      paginacion: { pagina, porPagina },
    }),
    contenedor.metodosPago.listar.ejecutar(),
    // RF-23: el catálogo del tipo del proyecto, para filtrar por categoría.
    contenedor.categorias.listar.ejecutar({
      filtro: { tipoProyectoId: proyecto.tipoProyectoId },
    }),
  ]);

  const hoy = contenedor.reloj.hoy();
  const neto = resultado.totales.ingresos - resultado.totales.egresos;

  // El proyecto de la ruta no cuenta como filtro: viene dado, no lo eligió nadie.
  const hayFiltro = Object.keys(filtro).some(
    (clave) => clave !== "proyectoId" && filtro[clave as keyof typeof filtro] !== undefined,
  );

  return (
    <div className="space-y-6">
      {/*
        Cabecera, acciones y pestañas: en el layout de `(secciones)`.

        Los indicadores solo aparecen CON filtro activo. Sin filtro coinciden con
        los del resumen del proyecto, que está a un clic en la pestaña de al lado:
        mostrarlos siempre era repetir información contigua y empujar la tabla
        —lo único que se vino a ver— unos 150 px hacia abajo. Con filtro, en
        cambio, dicen algo que ninguna otra vista dice: qué has aislado.
      */}
      {hayFiltro ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaIndicador
            etiqueta="Ingresos del filtro"
            valor={formatearDineroCompacto(resultado.totales.ingresos, proyecto.moneda)}
            tono="positivo"
            icono={<ArrowUpRight className="size-4" />}
          />
          <TarjetaIndicador
            etiqueta="Egresos del filtro"
            valor={formatearDineroCompacto(resultado.totales.egresos, proyecto.moneda)}
            icono={<ArrowDownRight className="size-4" />}
          />
          <TarjetaIndicador
            etiqueta="Neto del filtro"
            valor={formatearDineroCompacto(neto, proyecto.moneda)}
            tono={neto >= 0 ? "positivo" : "negativo"}
            detalle="Ingresos − egresos"
            icono={<Scale className="size-4" />}
          />
          <TarjetaIndicador
            etiqueta="Del cual es inversión"
            valor={formatearDineroCompacto(resultado.totales.invertido, proyecto.moneda)}
            detalle="Egresos que capitalizan"
            icono={<Landmark className="size-4" />}
          />
        </div>
      ) : null}

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <FiltrosMovimientos
          ocultarProyecto
          categorias={categorias.map((c) => ({ id: c.id, ruta: c.ruta }))}
          metodosPago={metodosPago.map((m) => ({ id: m.id, nombre: m.nombre }))}
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
          <TablaMovimientos
            filas={resultado.filas}
            metodosPago={metodosPago}
            hoy={hoy}
            formatoFecha={ajustes.formatoFecha}
            ocultarProyecto
            ordenable
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
