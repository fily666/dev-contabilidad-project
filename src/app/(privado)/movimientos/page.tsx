import { Suspense } from "react";
import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  FolderPlus,
  Landmark,
  Scale,
  Upload,
} from "lucide-react";

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
  const { contenedor, ajustes } = await contenedorPrivado();

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
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const moneda = proyectos[0]?.moneda ?? "COP";
  const hoy = contenedor.reloj.hoy();
  const neto = resultado.totales.ingresos - resultado.totales.egresos;

  const opcionesProyecto = proyectos.map((p) => ({
    id: p.proyectoId,
    nombre: p.nombre,
    moneda: p.moneda,
    // Aqui se listan todas las categorias: el formulario las acota al tipo del
    // proyecto que se elija, porque el proyecto se escoge dentro del dialogo.
    tipoProyectoId: p.tipoProyectoId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta-dato">Flujo de caja</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Ingresos y egresos de todos tus proyectos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* RF-27 */}
          <EnlaceBoton href="/movimientos/importar" variant="secondary">
            <Upload className="size-4" aria-hidden /> Importar CSV
          </EnlaceBoton>
          <DialogoNuevoMovimiento
            proyectos={opcionesProyecto}
            categorias={categorias}
            metodosPago={metodosPago}
            hoy={hoy}
          />
        </div>
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
          {/*
            Cuatro cifras en línea, y el neto entre ellas.

            Aquí vivía además un `PanelGrafica` con `AnillosConcentricos` que
            mostraba EXACTAMENTE estas mismas cifras con el mismo formato, a la
            derecha de las tarjetas: el caso más literal de «el mismo valor
            expresado de dos formas». Y su forma engañaba: los tres anillos se
            dibujaban como si repartieran un total, pero ingresos + egresos = flujo,
            así que los dos primeros sumaban el 100 % y el tercero —la inversión—
            se solapaba sobre el segundo por ser un subconjunto de los egresos.

            El neto es nuevo: estaban ingresos y egresos, y restarlos era trabajo
            del usuario.
          */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaIndicador
              etiqueta="Ingresos del filtro"
              valor={formatearDineroCompacto(resultado.totales.ingresos, moneda)}
              tono="positivo"
              icono={<ArrowUpRight className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Egresos del filtro"
              valor={formatearDineroCompacto(resultado.totales.egresos, moneda)}
              icono={<ArrowDownRight className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Neto del filtro"
              valor={formatearDineroCompacto(neto, moneda)}
              tono={neto >= 0 ? "positivo" : "negativo"}
              detalle="Ingresos − egresos"
              icono={<Scale className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Del cual es inversión"
              valor={formatearDineroCompacto(resultado.totales.invertido, moneda)}
              detalle="Egresos que capitalizan"
              icono={<Landmark className="size-4" />}
            />
          </div>

          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <FiltrosMovimientos
              proyectos={opcionesProyecto.map((p) => ({ id: p.id, nombre: p.nombre }))}
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
        </>
      )}
    </div>
  );
}
