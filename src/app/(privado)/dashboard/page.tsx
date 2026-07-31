import { Suspense } from "react";
import type { Metadata } from "next";
import { Banknote, FolderKanban, Landmark, Plus, Receipt, Scale, TrendingUp } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import {
  formatearDineroCompacto,
  formatearMesCorto,
  formatearPorcentaje,
} from "@/shared/utils/formato";
import { BarrasComparativas } from "@/shared/ui/viz/barras-comparativas";
import { BarrasRanking } from "@/shared/ui/viz/barras-ranking";
import { GraficoFlujo } from "@/shared/ui/viz/grafico-flujo";
import { MedidorAnillo } from "@/shared/ui/viz/medidor-anillo";
import { MedidorLineal } from "@/shared/ui/viz/medidor-lineal";
import { PanelGrafica, TablaDeDatos } from "@/shared/ui/viz/panel-grafica";
import { razonAcotada } from "@/shared/ui/viz/escala";
import { TarjetaProyecto } from "@/modules/proyectos/presentation/components/tarjeta-proyecto";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { FiltrosPanel } from "@/modules/dashboard/presentation/components/filtros-panel";
import {
  leerFiltroPanel,
  type ParametrosBusqueda,
} from "@/modules/dashboard/presentation/leer-filtros";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<ParametrosBusqueda> };

/**
 * RF-70 a RF-79.
 *
 * Todas las cifras vienen del caso de uso `ObtenerPanel`, que las lee de las
 * vistas de §6.4. La pagina no suma nada por su cuenta: antes calculaba los
 * totales recorriendo los proyectos, y eso era una segunda definicion de cada
 * cifra esperando a discrepar de la del resumen de proyecto (ADR-11).
 */
export default async function PaginaDashboard({ searchParams }: Props) {
  const parametros = await searchParams;
  const { contenedor, ajustes } = await contenedorPrivado();

  const filtro = leerFiltroPanel(parametros, contenedor.dashboard.panel.rangoPorOmision());
  const [panel, metodosPago] = await Promise.all([
    contenedor.dashboard.panel.ejecutar({ filtro }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const { totales, proyectos } = panel;
  const moneda = totales.moneda;
  const flujo = totales.totalIngresos + totales.totalEgresos;
  const hoy = contenedor.reloj.hoy();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta-dato">Panel general</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted-foreground">
            Cifras ejecutadas del rango seleccionado: solo los movimientos pagados alimentan la
            caja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnlaceBoton href="/reportes" variant="secondary">
            Reportes
          </EnlaceBoton>
          <EnlaceBoton href="/proyectos/nuevo">
            <Plus className="size-4" aria-hidden /> Nuevo proyecto
          </EnlaceBoton>
        </div>
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderKanban className="size-7" />}
          titulo="Empieza creando tu primer proyecto"
          descripcion="Un inmueble, un vehículo, un negocio o una inversión. Cada proyecto lleva su propia inversión, gastos, ingresos y rentabilidad."
          accion={
            <EnlaceBoton href="/proyectos/nuevo">
              <Plus className="size-4" aria-hidden /> Crear proyecto
            </EnlaceBoton>
          }
        />
      ) : (
        <>
          {/* RF-79: un solo filtro para todo el panel. */}
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <FiltrosPanel
              proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
              desde={filtro.desde ?? hoy}
              hasta={filtro.hasta ?? hoy}
            />
          </Suspense>

          {/* Cifra protagonista de la vista + razones clave. */}
          <section
            aria-label="Balance consolidado"
            className="panel panel-acento grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
          >
            <div className="min-w-0">
              <p className="etiqueta-dato">Balance general</p>
              <p className="cifra-heroe mt-2 text-5xl">
                {formatearDineroCompacto(totales.balance, moneda)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Ingresos − egresos del rango. Flujo registrado:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatearDineroCompacto(flujo, moneda)}
                </span>
                .
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <MedidorLineal
                  etiqueta="Ingresos sobre el flujo"
                  razon={razonAcotada(totales.totalIngresos, flujo)}
                  valorTexto={formatearDineroCompacto(totales.totalIngresos, moneda)}
                  serie={1}
                />
                <MedidorLineal
                  etiqueta="Egresos sobre el flujo"
                  razon={razonAcotada(totales.totalEgresos, flujo)}
                  valorTexto={formatearDineroCompacto(totales.totalEgresos, moneda)}
                  serie={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:border-l lg:border-border/70 lg:pl-8">
              <MedidorAnillo
                etiqueta="Cobertura"
                detalle="Ingresos / egresos"
                razon={razonAcotada(totales.totalIngresos, totales.totalEgresos)}
                valorTexto={formatearPorcentaje(
                  totales.totalEgresos > 0 ? totales.totalIngresos / totales.totalEgresos : null,
                  0,
                )}
                serie={1}
              />
              <MedidorAnillo
                etiqueta="Capitalizado"
                detalle="Inversión / egresos"
                razon={razonAcotada(totales.totalInvertido, totales.totalEgresos)}
                valorTexto={formatearPorcentaje(
                  totales.totalEgresos > 0 ? totales.totalInvertido / totales.totalEgresos : null,
                  0,
                )}
                serie={2}
              />
              <MedidorAnillo
                etiqueta="Activos"
                detalle={`${panel.proyectosActivos} de ${proyectos.length}`}
                razon={razonAcotada(panel.proyectosActivos, proyectos.length)}
                valorTexto={String(panel.proyectosActivos)}
                serie={3}
              />
            </div>
          </section>

          {/* RF-70 */}
          <section aria-label="Indicadores globales">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TarjetaIndicador
                etiqueta="Total invertido"
                valor={formatearDineroCompacto(totales.totalInvertido, moneda)}
                detalle="Egresos que capitalizan"
                icono={<Landmark className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del total de egresos"
                    razon={razonAcotada(totales.totalInvertido, totales.totalEgresos)}
                    serie={2}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Total de ingresos"
                valor={formatearDineroCompacto(totales.totalIngresos, moneda)}
                tono="positivo"
                detalle="Dinero recibido"
                icono={<Banknote className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del flujo registrado"
                    razon={razonAcotada(totales.totalIngresos, flujo)}
                    serie={1}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Total de egresos"
                valor={formatearDineroCompacto(totales.totalEgresos, moneda)}
                detalle="Inversión + gastos + cuotas"
                icono={<Receipt className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del flujo registrado"
                    razon={razonAcotada(totales.totalEgresos, flujo)}
                    serie={2}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Balance general"
                valor={formatearDineroCompacto(totales.balance, moneda)}
                tono={totales.balance >= 0 ? "positivo" : "negativo"}
                detalle="Ingresos − egresos"
                icono={<Scale className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Cobertura de egresos"
                    razon={razonAcotada(totales.totalIngresos, totales.totalEgresos)}
                    serie={1}
                  />
                }
              />
            </div>
          </section>

          {/* RF-73 */}
          <div className="grid gap-4 xl:grid-cols-2">
            <PanelAgenda
              eventos={panel.obligacionesVencidas}
              metodosPago={metodosPago}
              hoy={hoy}
              formatoFecha={ajustes.formatoFecha}
              titulo="Obligaciones vencidas"
              vacio={{
                titulo: "Nada vencido",
                descripcion: "No hay obligaciones con fecha pasada sin pagar.",
              }}
            />
            <PanelAgenda
              eventos={panel.proximosPagos}
              metodosPago={metodosPago}
              hoy={hoy}
              formatoFecha={ajustes.formatoFecha}
              titulo="Próximos pagos (30 días)"
              vacio={{
                titulo: "Sin pagos próximos",
                descripcion: "No hay vencimientos en los próximos 30 días.",
              }}
            />
          </div>

          {/* RF-71 y RF-72 */}
          <div className="grid gap-4 xl:grid-cols-2">
            <PanelGrafica
              titulo="Flujo de caja ejecutado"
              descripcion="Ingresos y egresos pagados, mes a mes."
              leyenda={[
                { etiqueta: "Ingresos", serie: 1 },
                { etiqueta: "Egresos", serie: 2 },
              ]}
            >
              {panel.flujoMensual.length === 0 ? (
                <EstadoVacio
                  titulo="Sin movimientos pagados en el rango"
                  descripcion="Amplía el rango o registra movimientos."
                />
              ) : (
                <GraficoFlujo puntos={panel.flujoMensual} moneda={moneda} />
              )}
            </PanelGrafica>

            <PanelGrafica
              titulo="Flujo proyectado"
              descripcion="Obligaciones y movimientos comprometidos que aún no se han ejecutado."
              leyenda={[
                { etiqueta: "Esperado", serie: 1 },
                { etiqueta: "Estimado", serie: 2 },
              ]}
            >
              {panel.flujoProyectado.length === 0 ? (
                <EstadoVacio
                  titulo="Sin compromisos futuros"
                  descripcion="Registra obligaciones para ver la proyección de los próximos meses."
                />
              ) : (
                <GraficoFlujo puntos={panel.flujoProyectado} moneda={moneda} />
              )}
            </PanelGrafica>
          </div>

          {/* RF-75 y RF-76 */}
          <div className="grid gap-4 xl:grid-cols-2">
            <PanelGrafica
              titulo="Evolución del gasto"
              descripcion="Egreso de cada mes y su acumulado dentro del rango."
              leyenda={[
                { etiqueta: "Del mes", serie: 2 },
                { etiqueta: "Acumulado", serie: 3 },
              ]}
            >
              {panel.evolucionGastos.length === 0 ? (
                <EstadoVacio
                  titulo="Sin egresos en el rango"
                  descripcion="Ajusta el rango de fechas o registra movimientos."
                />
              ) : (
                <BarrasComparativas
                  categorias={panel.evolucionGastos.map((punto) => ({
                    etiqueta: formatearMesCorto(punto.mes),
                    valores: [punto.egresos, punto.acumulado],
                  }))}
                  series={[
                    { etiqueta: "Del mes", serie: 2 },
                    { etiqueta: "Acumulado", serie: 3 },
                  ]}
                  moneda={moneda}
                  tituloTabla="Evolución del gasto por mes"
                />
              )}
            </PanelGrafica>

            <PanelGrafica
              titulo="Gasto por categoría"
              descripcion="Distribución de los egresos del rango, agrupados por categoría raíz."
            >
              {panel.gastosPorCategoria.length === 0 ? (
                <EstadoVacio
                  titulo="Sin gastos en el rango"
                  descripcion="Cuando registres egresos verás aquí en qué se va el dinero."
                />
              ) : (
                <BarrasRanking
                  filas={panel.gastosPorCategoria.map((g) => ({
                    etiqueta: g.categoria,
                    valor: g.total,
                  }))}
                  moneda={moneda}
                  serie={2}
                />
              )}
            </PanelGrafica>
          </div>

          {/* RF-74 */}
          <PanelGrafica
            titulo="Rentabilidad por proyecto"
            descripcion="Solo proyectos con ingresos: el ROI de un vehículo y el de un arriendo no son comparables (§5.4)."
          >
            {panel.rentabilidad.length === 0 ? (
              <EstadoVacio
                icono={<TrendingUp className="size-6" />}
                titulo="Sin proyectos con ingresos"
                descripcion="La rentabilidad necesita ingresos para ser calculable (§5.3)."
              />
            ) : (
              <TablaDeDatos
                titulo="Rentabilidad por proyecto"
                columnas={["Invertido", "Ingresos", "Balance", "ROI"]}
                filas={panel.rentabilidad.map((fila) => ({
                  etiqueta: fila.nombre,
                  valores: [
                    formatearDineroCompacto(fila.totalInvertido, fila.moneda),
                    formatearDineroCompacto(fila.totalIngresos, fila.moneda),
                    formatearDineroCompacto(fila.balance, fila.moneda),
                    formatearPorcentaje(fila.roi, 1),
                  ],
                }))}
              />
            )}
          </PanelGrafica>

          {/* RF-77 */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="etiqueta-dato">Resumen por proyecto</h2>
              <EnlaceBoton href="/proyectos" variant="ghost" size="sm">
                Ver todos ({proyectos.length})
              </EnlaceBoton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {proyectos.slice(0, 6).map((proyecto) => (
                <TarjetaProyecto
                  key={proyecto.proyectoId}
                  proyecto={proyecto}
                  formatoFecha={ajustes.formatoFecha}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
