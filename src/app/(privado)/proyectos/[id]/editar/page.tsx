import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { FormularioProyecto } from "@/modules/proyectos/presentation/components/formulario-proyecto";

export const metadata: Metadata = { title: "Editar proyecto" };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor } = await contenedorPrivado();

  const [proyecto, tipos] = await Promise.all([
    contenedor.proyectos.obtener.buscar({ id }),
    contenedor.proyectos.listarTipos.ejecutar(),
  ]);

  if (!proyecto) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabeceraPagina
        ambito={proyecto.nombre}
        titulo="Editar proyecto"
        acciones={
          <EnlaceBoton href={`/proyectos/${proyecto.id}`} variant="ghost" size="sm">
            Cancelar y volver
          </EnlaceBoton>
        }
      />
      <FormularioProyecto
        hoy={contenedor.reloj.hoy()}
        tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre, configuracion: t.configuracion }))}
        proyecto={{
          id: proyecto.id,
          tipoProyectoId: proyecto.tipoProyectoId,
          nombre: proyecto.nombre,
          descripcion: proyecto.descripcion,
          fechaInicio: proyecto.fechaInicio,
          fechaFin: proyecto.fechaFin,
          atributos: proyecto.atributos,
        }}
      />
    </div>
  );
}
