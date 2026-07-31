import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, BellRing } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { DialogoObligacion } from "@/modules/obligaciones/presentation/components/dialogo-obligacion";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { TablaObligaciones } from "@/modules/obligaciones/presentation/components/tabla-obligaciones";

export const metadata: Metadata = { title: "Obligaciones del proyecto" };

type Props = { params: Promise<{ id: string }> };

/** RF-15, RF-50 a RF-58 en el ámbito de un proyecto. */
export default async function PaginaObligacionesProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyecto = await contenedor.proyectos.obtener.buscar({ id });
  if (!proyecto) notFound();

  const [obligaciones, agenda, categorias, metodosPago] = await Promise.all([
    contenedor.obligaciones.listar.ejecutar({ filtro: { proyectoId: id } }),
    contenedor.obligaciones.listarAgenda.ejecutar({
      filtro: { proyectoId: id, dentroDeDias: 90, incluirVencidas: true },
    }),
    contenedor.categorias.listar.ejecutar({
      filtro: { tipoProyectoId: proyecto.tipoProyectoId },
    }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const hoy = contenedor.reloj.hoy();

  return (
    <div className="space-y-6">
      <div>
        <EnlaceBoton href={`/proyectos/${id}`} variant="ghost" size="sm" className="mb-2 -ml-2">
          <ArrowLeft className="size-4" aria-hidden /> {proyecto.nombre}
        </EnlaceBoton>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="etiqueta-dato">{proyecto.nombre}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Obligaciones</h1>
          </div>
          <DialogoObligacion
            proyectos={[{ id: proyecto.id, nombre: proyecto.nombre }]}
            categorias={categorias}
            hoy={hoy}
            horizonteMeses={ajustes.horizonteProyeccionMeses}
            formatoFecha={ajustes.formatoFecha}
            proyectoFijo={proyecto.id}
          />
        </div>
      </div>

      <PanelAgenda
        eventos={agenda}
        metodosPago={metodosPago}
        hoy={hoy}
        formatoFecha={ajustes.formatoFecha}
        titulo="Vencimientos de los próximos 90 días"
        ocultarProyecto
        vacio={{
          titulo: "Sin vencimientos próximos",
          descripcion: "Este proyecto no tiene ocurrencias pendientes en los próximos 90 días.",
        }}
      />

      {obligaciones.length === 0 ? (
        <EstadoVacio
          icono={<BellRing className="size-8" />}
          titulo="Este proyecto no tiene obligaciones"
          descripcion="Registra sus pagos recurrentes: cuota del crédito, administración, impuestos o seguros."
        />
      ) : (
        <TablaObligaciones
          filas={obligaciones}
          categorias={categorias}
          hoy={hoy}
          horizonteMeses={ajustes.horizonteProyeccionMeses}
          formatoFecha={ajustes.formatoFecha}
          ocultarProyecto
        />
      )}
    </div>
  );
}
