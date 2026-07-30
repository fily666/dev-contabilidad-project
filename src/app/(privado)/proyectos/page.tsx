import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaProyecto } from "@/modules/proyectos/presentation/components/tarjeta-proyecto";
import { ESTADOS_PROYECTO, type EstadoProyecto } from "@/shared/domain/enumeraciones";
import { ETIQUETA_ESTADO_PROYECTO } from "@/shared/utils/etiquetas";
import { cn } from "@/shared/utils/cn";

export const metadata: Metadata = { title: "Proyectos" };

type Props = { searchParams: Promise<{ estado?: string }> };

/** RF-10, RF-77. */
export default async function PaginaProyectos({ searchParams }: Props) {
  const { estado } = await searchParams;
  const { contenedor } = await contenedorPrivado();

  const estadoFiltro = ESTADOS_PROYECTO.includes(estado as EstadoProyecto)
    ? (estado as EstadoProyecto)
    : undefined;

  const proyectos = await contenedor.proyectos.listar.ejecutar({
    filtro: {
      // Por defecto se ocultan los archivados.
      estados: estadoFiltro ? [estadoFiltro] : ["activo", "pausado", "finalizado"],
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {proyectos.length === 1 ? "1 proyecto" : `${proyectos.length} proyectos`} en el filtro
            actual.
          </p>
        </div>
        <EnlaceBoton href="/proyectos/nuevo">
          <Plus className="size-4" aria-hidden /> Nuevo proyecto
        </EnlaceBoton>
      </div>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        <FiltroEstado activo={!estadoFiltro} href="/proyectos" etiqueta="Vigentes" />
        {ESTADOS_PROYECTO.map((e) => (
          <FiltroEstado
            key={e}
            activo={estadoFiltro === e}
            href={`/proyectos?estado=${e}`}
            etiqueta={ETIQUETA_ESTADO_PROYECTO[e]}
          />
        ))}
      </nav>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderKanban className="size-8" />}
          titulo="Aún no tienes proyectos aquí"
          descripcion="Crea tu primer proyecto —un inmueble, un vehículo, un negocio— y empieza a registrar su inversión, sus gastos y sus ingresos."
          accion={
            <EnlaceBoton href="/proyectos/nuevo">
              <Plus className="size-4" aria-hidden /> Crear proyecto
            </EnlaceBoton>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {proyectos.map((proyecto) => (
            <TarjetaProyecto key={proyecto.proyectoId} proyecto={proyecto} />
          ))}
        </div>
      )}
    </div>
  );
}

function FiltroEstado({
  activo,
  href,
  etiqueta,
}: {
  activo: boolean;
  href: string;
  etiqueta: string;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {etiqueta}
    </Link>
  );
}
