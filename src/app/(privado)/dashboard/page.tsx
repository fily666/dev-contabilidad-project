import type { Metadata } from "next";
import { Banknote, FolderKanban, Landmark, Plus, Receipt, Scale } from "lucide-react";

import { contenedorAutenticado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { TarjetaProyecto } from "@/modules/proyectos/presentation/components/tarjeta-proyecto";
import { TablaMovimientos } from "@/modules/movimientos/presentation/components/tabla-movimientos";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * RF-70, RF-77 (Fase 1). Las gráficas, el calendario y el flujo proyectado
 * llegan en la Fase 3 y 4 según el roadmap de Contexto.md §14.
 */
export default async function PaginaDashboard() {
  const { contenedor, sesion } = await contenedorAutenticado();

  const [proyectos, ultimos, metodosPago] = await Promise.all([
    contenedor.proyectos.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      filtro: { estados: ["activo", "pausado", "finalizado"] },
    }),
    contenedor.movimientos.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      paginacion: { pagina: 1, porPagina: 8 },
    }),
    contenedor.metodosPago.listar(sesion.usuarioId),
  ]);

  const moneda = proyectos[0]?.moneda ?? sesion.perfil.moneda;
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

  const nombre = sesion.perfil.nombreCompleto.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {nombre}</h1>
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
          icono={<FolderKanban className="size-8" />}
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
          <section aria-label="Indicadores globales">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TarjetaIndicador
                etiqueta="Total invertido"
                valor={formatearDineroCompacto(totales.invertido, moneda)}
                detalle="Egresos que capitalizan"
                icono={<Landmark className="size-4" />}
              />
              <TarjetaIndicador
                etiqueta="Total de ingresos"
                valor={formatearDineroCompacto(totales.ingresos, moneda)}
                tono="positivo"
                icono={<Banknote className="size-4" />}
              />
              <TarjetaIndicador
                etiqueta="Total de egresos"
                valor={formatearDineroCompacto(totales.egresos, moneda)}
                icono={<Receipt className="size-4" />}
              />
              <TarjetaIndicador
                etiqueta="Balance general"
                valor={formatearDineroCompacto(totales.balance, moneda)}
                tono={totales.balance >= 0 ? "positivo" : "negativo"}
                detalle="Ingresos − egresos"
                icono={<Scale className="size-4" />}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-lg font-medium">Proyectos</h2>
              <EnlaceBoton href="/proyectos" variant="ghost" size="sm">
                Ver todos
              </EnlaceBoton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {proyectos.slice(0, 6).map((proyecto) => (
                <TarjetaProyecto key={proyecto.proyectoId} proyecto={proyecto} />
              ))}
            </div>
          </section>

          {ultimos.filas.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-lg font-medium">Movimientos recientes</h2>
                <EnlaceBoton href="/movimientos" variant="ghost" size="sm">
                  Ver todos
                </EnlaceBoton>
              </div>
              <TablaMovimientos filas={ultimos.filas} metodosPago={metodosPago} hoy={hoy} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
