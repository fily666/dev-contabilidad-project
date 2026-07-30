import type { Metadata } from "next";
import { Banknote, FolderKanban, Landmark, Plus, Receipt, Scale } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto, formatearPorcentaje } from "@/shared/utils/formato";
import { BarrasComparativas } from "@/shared/ui/viz/barras-comparativas";
import { BarrasRanking } from "@/shared/ui/viz/barras-ranking";
import { MedidorAnillo } from "@/shared/ui/viz/medidor-anillo";
import { MedidorLineal } from "@/shared/ui/viz/medidor-lineal";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { razonAcotada } from "@/shared/ui/viz/escala";
import { TarjetaProyecto } from "@/modules/proyectos/presentation/components/tarjeta-proyecto";
import { TablaMovimientos } from "@/modules/movimientos/presentation/components/tabla-movimientos";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * RF-70, RF-77 (Fase 1). Las graficas se calculan sobre los agregados completos
 * de cada proyecto; el calendario y el flujo proyectado llegan en la Fase 3 y 4
 * segun el roadmap de Contexto.md §14.
 */
export default async function PaginaDashboard() {
  const { contenedor, ajustes } = await contenedorPrivado();

  const [proyectos, ultimos, metodosPago] = await Promise.all([
    contenedor.proyectos.listar.ejecutar({
      filtro: { estados: ["activo", "pausado", "finalizado"] },
    }),
    contenedor.movimientos.listar.ejecutar({
      paginacion: { pagina: 1, porPagina: 8 },
    }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const moneda = proyectos[0]?.moneda ?? ajustes.moneda;
  const hoy = contenedor.reloj.hoy();

  const totales = proyectos.reduce(
    (acc, p) => ({
      invertido: acc.invertido + p.totalInvertido,
      ingresos: acc.ingresos + p.totalIngresos,
      egresos: acc.egresos + p.totalEgresos,
      balance: acc.balance + p.balance,
    }),
    { invertido: 0, ingresos: 0, egresos: 0, balance: 0 },
  );

  const flujo = totales.ingresos + totales.egresos;
  const activos = proyectos.filter((p) => p.estado === "activo").length;

  // Cinco proyectos con mas movimiento economico, para que las columnas sean legibles.
  const masMovidos = [...proyectos]
    .sort((a, b) => b.totalIngresos + b.totalEgresos - (a.totalIngresos + a.totalEgresos))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta-dato">Panel general</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted-foreground">
            Estado consolidado de {proyectos.length}{" "}
            {proyectos.length === 1 ? "proyecto" : "proyectos"}.
          </p>
        </div>
        <EnlaceBoton href="/proyectos/nuevo">
          <Plus className="size-4" aria-hidden /> Nuevo proyecto
        </EnlaceBoton>
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
                Ingresos − egresos de todos los proyectos vigentes. Flujo registrado:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatearDineroCompacto(flujo, moneda)}
                </span>
                .
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <MedidorLineal
                  etiqueta="Ingresos sobre el flujo"
                  razon={razonAcotada(totales.ingresos, flujo)}
                  valorTexto={formatearDineroCompacto(totales.ingresos, moneda)}
                  serie={1}
                />
                <MedidorLineal
                  etiqueta="Egresos sobre el flujo"
                  razon={razonAcotada(totales.egresos, flujo)}
                  valorTexto={formatearDineroCompacto(totales.egresos, moneda)}
                  serie={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:border-l lg:border-border/70 lg:pl-8">
              <MedidorAnillo
                etiqueta="Cobertura"
                detalle="Ingresos / egresos"
                razon={razonAcotada(totales.ingresos, totales.egresos)}
                valorTexto={formatearPorcentaje(
                  totales.egresos > 0 ? totales.ingresos / totales.egresos : null,
                  0,
                )}
                serie={1}
              />
              <MedidorAnillo
                etiqueta="Capitalizado"
                detalle="Inversión / egresos"
                razon={razonAcotada(totales.invertido, totales.egresos)}
                valorTexto={formatearPorcentaje(
                  totales.egresos > 0 ? totales.invertido / totales.egresos : null,
                  0,
                )}
                serie={2}
              />
              <MedidorAnillo
                etiqueta="Activos"
                detalle={`${activos} de ${proyectos.length}`}
                razon={razonAcotada(activos, proyectos.length)}
                valorTexto={String(activos)}
                serie={3}
              />
            </div>
          </section>

          <section aria-label="Indicadores globales">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TarjetaIndicador
                etiqueta="Total invertido"
                valor={formatearDineroCompacto(totales.invertido, moneda)}
                detalle="Egresos que capitalizan"
                icono={<Landmark className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del total de egresos"
                    razon={razonAcotada(totales.invertido, totales.egresos)}
                    serie={2}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Total de ingresos"
                valor={formatearDineroCompacto(totales.ingresos, moneda)}
                tono="positivo"
                detalle="Dinero recibido"
                icono={<Banknote className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del flujo registrado"
                    razon={razonAcotada(totales.ingresos, flujo)}
                    serie={1}
                  />
                }
              />
              <TarjetaIndicador
                etiqueta="Total de egresos"
                valor={formatearDineroCompacto(totales.egresos, moneda)}
                detalle="Inversión + gastos + cuotas"
                icono={<Receipt className="size-4" />}
                pie={
                  <MedidorLineal
                    etiqueta="Del flujo registrado"
                    razon={razonAcotada(totales.egresos, flujo)}
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
                    razon={razonAcotada(totales.ingresos, totales.egresos)}
                    serie={1}
                  />
                }
              />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <PanelGrafica
              titulo="Ingresos y egresos por proyecto"
              descripcion="Cinco proyectos con más movimiento económico registrado."
              leyenda={[
                { etiqueta: "Ingresos", serie: 1 },
                { etiqueta: "Egresos", serie: 2 },
              ]}
              className="xl:col-span-2"
            >
              <BarrasComparativas
                moneda={moneda}
                tituloTabla="Ingresos y egresos por proyecto"
                series={[
                  { etiqueta: "Ingresos", serie: 1 },
                  { etiqueta: "Egresos", serie: 2 },
                ]}
                categorias={masMovidos.map((p) => ({
                  etiqueta: p.nombre,
                  valores: [p.totalIngresos, p.totalEgresos],
                }))}
              />
            </PanelGrafica>

            <PanelGrafica
              titulo="Inversión acumulada"
              descripcion="Capital que ha capitalizado cada proyecto."
            >
              <BarrasRanking
                moneda={moneda}
                serie={3}
                filas={proyectos.map((p) => ({ etiqueta: p.nombre, valor: p.totalInvertido }))}
              />
            </PanelGrafica>
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="etiqueta-dato">Proyectos</h2>
              <EnlaceBoton href="/proyectos" variant="ghost" size="sm">
                Ver todos
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

          {ultimos.filas.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="etiqueta-dato">Movimientos recientes</h2>
                <EnlaceBoton href="/movimientos" variant="ghost" size="sm">
                  Ver todos
                </EnlaceBoton>
              </div>
              <TablaMovimientos
                filas={ultimos.filas}
                metodosPago={metodosPago}
                hoy={hoy}
                formatoFecha={ajustes.formatoFecha}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
