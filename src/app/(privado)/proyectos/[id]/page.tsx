import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftRight, ArrowLeft } from "lucide-react";

import { contenedorAutenticado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { InsigniaEstadoProyecto } from "@/shared/ui/insignias";
import { formatearFecha } from "@/shared/utils/formato";
import { AccionesProyecto } from "@/modules/proyectos/presentation/components/acciones-proyecto";
import { PanelIndicadores } from "@/modules/proyectos/presentation/components/panel-indicadores";
import { DialogoNuevoMovimiento } from "@/modules/movimientos/presentation/components/dialogo-nuevo-movimiento";
import { TablaMovimientos } from "@/modules/movimientos/presentation/components/tabla-movimientos";

export const metadata: Metadata = { title: "Detalle del proyecto" };

type Props = { params: Promise<{ id: string }> };

/** RF-15, RF-77 y fórmulas de §5. */
export default async function PaginaProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, sesion } = await contenedorAutenticado();

  const resumen = await contenedor.proyectos.resumen
    .ejecutar({ proyectoId: id, propietarioId: sesion.usuarioId })
    .catch(() => null);

  if (!resumen) notFound();

  const { proyecto, tipo, indicadores, indicadoresVisibles } = resumen;

  const [ultimos, categorias, metodosPago] = await Promise.all([
    contenedor.movimientos.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      filtro: { proyectoId: id },
      paginacion: { pagina: 1, porPagina: 8 },
    }),
    contenedor.categorias.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      filtro: { tipoProyectoId: proyecto.tipoProyectoId },
    }),
    contenedor.metodosPago.listar(sesion.usuarioId),
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{proyecto.nombre}</h1>
              <InsigniaEstadoProyecto estado={proyecto.estado} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {tipo.nombre} · Inicio {formatearFecha(proyecto.fechaInicio)}
              {proyecto.fechaFin ? ` · Cierre ${formatearFecha(proyecto.fechaFin)}` : ""}
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

      {atributos.length > 0 ? (
        <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3 lg:grid-cols-5">
          {atributos.map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-xs text-muted-foreground">
                {etiquetaAtributo.get(clave) ?? clave}
              </dt>
              <dd className="truncate text-sm font-medium">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <PanelIndicadores indicadores={indicadores} visibles={indicadoresVisibles} />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-medium">Últimos movimientos</h2>
          {ultimos.total > 0 ? (
            <EnlaceBoton href={`/proyectos/${proyecto.id}/movimientos`} variant="ghost" size="sm">
              Ver todos ({ultimos.total})
            </EnlaceBoton>
          ) : null}
        </div>

        {ultimos.filas.length === 0 ? (
          <EstadoVacio
            icono={<ArrowLeftRight className="size-8" />}
            titulo="Sin movimientos todavía"
            descripcion="Registra la separación, la cuota inicial o el primer gasto para empezar a ver los indicadores."
          />
        ) : (
          <TablaMovimientos
            filas={ultimos.filas}
            metodosPago={metodosPago}
            hoy={hoy}
            ocultarProyecto
          />
        )}
      </section>
    </div>
  );
}
