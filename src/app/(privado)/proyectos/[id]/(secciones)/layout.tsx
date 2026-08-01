import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { InsigniaEstadoFinanciero, InsigniaEstadoProyecto } from "@/shared/ui/insignias";
import { formatearFecha } from "@/shared/utils/formato";
import { AccionesProyecto } from "@/modules/proyectos/presentation/components/acciones-proyecto";
import { PestanasProyecto } from "@/modules/proyectos/presentation/components/pestanas-proyecto";
import { DialogoNuevoMovimiento } from "@/modules/movimientos/presentation/components/dialogo-nuevo-movimiento";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

/**
 * Shell de las cinco secciones de un proyecto (RF-15, Contexto.md §7.2).
 *
 * Aquí viven la identidad del proyecto, sus acciones y las pestañas, que antes se
 * repetían —o desaparecían— en cada subvista:
 *
 * - Cada subruta abría con un botón «← nombre del proyecto» y repetía justo debajo
 *   el mismo nombre como etiqueta de dato y luego el `h1` de la sección: tres
 *   líneas y unos 96 px para decir dos cosas, en cinco vistas.
 * - Los cuatro enlaces a las secciones solo existían en el detalle, así que pasar
 *   de Movimientos a Obligaciones del mismo proyecto costaba dos clics.
 * - Las cinco páginas consultaban el proyecto por su cuenta. Ahora lo consulta el
 *   layout; las páginas que necesitan el proyecto completo lo vuelven a pedir, y
 *   deduplicarlo dentro del request es el punto R-04 de la auditoría.
 *
 * El grupo de rutas `(secciones)` es lo que deja fuera a `/editar`, que es un
 * formulario centrado y no una sección con pestañas. El paréntesis no aparece en
 * la URL.
 */
export default async function LayoutSeccionesProyecto({ children, params }: Props) {
  const { id } = await params;
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyecto = await contenedor.proyectos.obtener.buscar({ id });
  if (!proyecto) notFound();

  const [tipos, categorias, metodosPago] = await Promise.all([
    contenedor.proyectos.listarTipos.ejecutar(),
    contenedor.categorias.listar.ejecutar({ filtro: { tipoProyectoId: proyecto.tipoProyectoId } }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const tipo = tipos.find((t) => t.id === proyecto.tipoProyectoId);
  const hoy = contenedor.reloj.hoy();

  // §5.5: el indicador que §3 exige y que ninguna pantalla mostraba. Va en la
  // cabecera, junto al estado: la señal antes que cualquier cifra.
  const semaforos = await contenedor.dashboard.semaforos.ejecutar([
    { proyectoId: proyecto.id, tipoProyectoId: proyecto.tipoProyectoId },
  ]);
  const semaforo = semaforos.get(proyecto.id);

  return (
    <div className="space-y-6">
      <div>
        <EnlaceBoton href="/proyectos" variant="ghost" size="sm" className="mb-2 -ml-2 sm:hidden">
          <ArrowLeft className="size-4" aria-hidden /> Proyectos
        </EnlaceBoton>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="etiqueta-dato">{tipo?.nombre ?? "Proyecto"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{proyecto.nombre}</h1>
              <InsigniaEstadoProyecto estado={proyecto.estado} />
              {semaforo ? (
                <InsigniaEstadoFinanciero estado={semaforo.estado} motivo={semaforo.motivo} />
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicio {formatearFecha(proyecto.fechaInicio, ajustes.formatoFecha)}
              {proyecto.fechaFin
                ? ` · Cierre ${formatearFecha(proyecto.fechaFin, ajustes.formatoFecha)}`
                : ""}
            </p>
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

      <PestanasProyecto proyectoId={proyecto.id} />

      {children}
    </div>
  );
}
