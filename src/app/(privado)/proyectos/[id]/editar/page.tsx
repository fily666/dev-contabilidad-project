import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contenedorPrivado } from "@/di/container";
import { FormularioProyecto } from "@/modules/proyectos/presentation/components/formulario-proyecto";

export const metadata: Metadata = { title: "Editar proyecto" };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor } = await contenedorPrivado();

  const [proyecto, tipos] = await Promise.all([
    contenedor.proyectos.repositorio.buscarPorId(id),
    contenedor.proyectos.listarTipos.ejecutar(),
  ]);

  if (!proyecto) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="etiqueta-dato">{proyecto.nombre}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Editar proyecto</h1>
      </div>
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
