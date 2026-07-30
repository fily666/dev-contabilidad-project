import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftRight, ArrowLeft } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { InsigniaEstadoProyecto } from "@/shared/ui/insignias";
import {
  formatearDineroCompacto,
  formatearFecha,
  formatearPorcentaje,
} from "@/shared/utils/formato";
import { GraficoFlujo } from "@/shared/ui/viz/grafico-flujo";
import { MedidorAnillo } from "@/shared/ui/viz/medidor-anillo";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { razonAcotada } from "@/shared/ui/viz/escala";
import { AccionesProyecto } from "@/modules/proyectos/presentation/components/acciones-proyecto";
import { PanelIndicadores } from "@/modules/proyectos/presentation/components/panel-indicadores";
import { DialogoNuevoMovimiento } from "@/modules/movimientos/presentation/components/dialogo-nuevo-movimiento";
import { TablaMovimientos } from "@/modules/movimientos/presentation/components/tabla-movimientos";

export const metadata: Metadata = { title: "Detalle del proyecto" };

type Props = { params: Promise<{ id: string }> };

/** RF-15, RF-77 y fórmulas de §5. */
export default async function PaginaProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, ajustes } = await contenedorPrivado();

  const resumen = await contenedor.proyectos.resumen.ejecutar({ proyectoId: id }).catch(() => null);

  if (!resumen) notFound();

  const { proyecto, tipo, indicadores, indicadoresVisibles, flujoMensual } = resumen;

  const [ultimos, categorias, metodosPago] = await Promise.all([
    contenedor.movimientos.listar.ejecutar({
      filtro: { proyectoId: id },
      paginacion: { pagina: 1, porPagina: 8 },
    }),
    contenedor.categorias.listar.ejecutar({
      filtro: { tipoProyectoId: proyecto.tipoProyectoId },
    }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const hoy = contenedor.reloj.hoy();
  const atributos = Object.entries(proyecto.atributos);
  const etiquetaAtributo = new Map(tipo.configuracion.atributos.map((a) => [a.clave, a.etiqueta]));

  return (
    <div className="space-y-6">
      <div>
        <EnlaceBoton href="/proyectos" variant="ghost" size="sm" className="mb-2 -ml-2">
          <ArrowLeft className="size-4" aria-hidden /> Proyectos
        </EnlaceBoton>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="etiqueta-dato">{tipo.nombre}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{proyecto.nombre}</h1>
              <InsigniaEstadoProyecto estado={proyecto.estado} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicio {formatearFecha(proyecto.fechaInicio, ajustes.formatoFecha)}
              {proyecto.fechaFin
                ? ` · Cierre ${formatearFecha(proyecto.fechaFin, ajustes.formatoFecha)}`
                : ""}
            </p>
            {proyecto.descripcion ? (
              <p className="mt-2 max-w-2xl text-sm">{proyecto.descripcion}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DialogoNuevoMovimiento
              proyectos={[{ id: proyecto.id, nombre: proyecto.nombre, moneda: proyecto.moneda }]}
              categorias={categorias}
              metodosPago={metodosPago}
              hoy={hoy}
              proyectoFijo={proyecto.id}
              etiqueta="Registrar movimiento"
            />
            <AccionesProyecto id={proyecto.id} estado={proyecto.estado} />
          </div>
        </div>
      </div>

      {/* Cifra protagonista del proyecto y sus razones principales. */}
      <section
        aria-label="Balance del proyecto"
        className="panel panel-acento grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      >
        <div className="min-w-0">
          <p className="etiqueta-dato">Balance</p>
          <p className="cifra-heroe mt-2 text-5xl">
            {formatearDineroCompacto(indicadores.balance, indicadores.moneda)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresos {formatearDineroCompacto(indicadores.totalIngresos, indicadores.moneda)} −
            egresos {formatearDineroCompacto(indicadores.totalEgresos, indicadores.moneda)} ·{" "}
            {indicadores.mesesDeHistoria} {indicadores.mesesDeHistoria === 1 ? "mes" : "meses"} de
            historia.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:border-l lg:border-border/70 lg:pl-8">
          <MedidorAnillo
            etiqueta="Cobertura"
            detalle="Ingresos / egresos"
            razon={razonAcotada(indicadores.totalIngresos, indicadores.totalEgresos)}
            valorTexto={formatearPorcentaje(
              indicadores.totalEgresos > 0
                ? indicadores.totalIngresos / indicadores.totalEgresos
                : null,
              0,
            )}
            serie={1}
          />
          <MedidorAnillo
            etiqueta="Capitalizado"
            detalle="Inversión / egresos"
            razon={razonAcotada(indicadores.totalInvertido, indicadores.totalEgresos)}
            valorTexto={formatearPorcentaje(
              indicadores.totalEgresos > 0
                ? indicadores.totalInvertido / indicadores.totalEgresos
                : null,
              0,
            )}
            serie={2}
          />
          <MedidorAnillo
            etiqueta="ROI"
            detalle="Resultado / invertido"
            razon={razonAcotada(indicadores.roiAcumulado, 1)}
            valorTexto={formatearPorcentaje(indicadores.roiAcumulado, 0)}
            serie={3}
          />
        </div>
      </section>

      {atributos.length > 0 ? (
        <dl className="panel grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
          {atributos.map(([clave, valor]) => (
            <div key={clave}>
              <dt className="etiqueta-dato">{etiquetaAtributo.get(clave) ?? clave}</dt>
              <dd className="mt-1 truncate text-sm font-medium">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <PanelGrafica
        titulo="Flujo mensual"
        descripcion="Ingresos y egresos pagados de los últimos doce meses."
        leyenda={[
          { etiqueta: "Ingresos", serie: 1 },
          { etiqueta: "Egresos", serie: 2 },
        ]}
      >
        <GraficoFlujo puntos={flujoMensual} moneda={indicadores.moneda} />
      </PanelGrafica>

      <PanelIndicadores indicadores={indicadores} visibles={indicadoresVisibles} />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="etiqueta-dato">Últimos movimientos</h2>
          {ultimos.total > 0 ? (
            <EnlaceBoton href={`/proyectos/${proyecto.id}/movimientos`} variant="ghost" size="sm">
              Ver todos ({ultimos.total})
            </EnlaceBoton>
          ) : null}
        </div>

        {ultimos.filas.length === 0 ? (
          <EstadoVacio
            icono={<ArrowLeftRight className="size-7" />}
            titulo="Sin movimientos todavía"
            descripcion="Registra la separación, la cuota inicial o el primer gasto para empezar a ver los indicadores."
          />
        ) : (
          <TablaMovimientos
            filas={ultimos.filas}
            metodosPago={metodosPago}
            hoy={hoy}
            formatoFecha={ajustes.formatoFecha}
            ocultarProyecto
          />
        )}
      </section>
    </div>
  );
}
