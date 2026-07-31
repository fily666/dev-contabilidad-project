import { Suspense } from "react";
import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  FolderPlus,
  Landmark,
  Upload,
} from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { AnillosConcentricos } from "@/shared/ui/viz/medidor-anillo";
import { MedidorLineal } from "@/shared/ui/viz/medidor-lineal";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { razonAcotada } from "@/shared/ui/viz/escala";
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
  const flujo = resultado.totales.ingresos + resultado.totales.egresos;

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
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="grid gap-3 sm:grid-cols-3 xl:col-span-2 xl:grid-cols-3">
              <TarjetaIndicador
                etiqueta="Ingresos del filtro"
                valor={formatearDineroCompacto(resultado.totales.ingresos, moneda)}
                tono="positivo"
                icono={<ArrowUpRight className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del flujo filtrado"
                    razon={razonAcotada(resultado.totales.ingresos, flujo)}
                    serie={1}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Egresos del filtro"
                valor={formatearDineroCompacto(resultado.totales.egresos, moneda)}
                icono={<ArrowDownRight className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del flujo filtrado"
                    razon={razonAcotada(resultado.totales.egresos, flujo)}
                    serie={2}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Del cual es inversión"
                valor={formatearDineroCompacto(resultado.totales.invertido, moneda)}
                detalle="Egresos que capitalizan"
                icono={<Landmark className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="De los egresos"
                    razon={razonAcotada(resultado.totales.invertido, resultado.totales.egresos)}
                    serie={3}
                  />
                }
              />
            </div>

            <PanelGrafica
              titulo="Composición del filtro"
              descripcion="Reparto del flujo registrado en los movimientos seleccionados."
            >
              <AnillosConcentricos
                totalTexto={formatearDineroCompacto(flujo, moneda)}
                totalEtiqueta="Flujo"
                series={[
                  {
                    etiqueta: "Ingresos",
                    razon: razonAcotada(resultado.totales.ingresos, flujo),
                    valorTexto: formatearDineroCompacto(resultado.totales.ingresos, moneda),
                    serie: 1,
                  },
                  {
                    etiqueta: "Egresos",
                    razon: razonAcotada(resultado.totales.egresos, flujo),
                    valorTexto: formatearDineroCompacto(resultado.totales.egresos, moneda),
                    serie: 2,
                  },
                  {
                    etiqueta: "Del cual inversión",
                    razon: razonAcotada(resultado.totales.invertido, flujo),
                    valorTexto: formatearDineroCompacto(resultado.totales.invertido, moneda),
                    serie: 3,
                  },
                ]}
              />
            </PanelGrafica>
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
              <TablaMovimientos
                filas={resultado.filas}
                metodosPago={metodosPago}
                hoy={hoy}
                formatoFecha={ajustes.formatoFecha}
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
