import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contenedorAutenticado } from "@/di/container";
import { FormularioProyecto } from "@/modules/proyectos/presentation/components/formulario-proyecto";

export const metadata: Metadata = { title: "Editar proyecto" };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, sesion } = await contenedorAutenticado();

  const [proyecto, tipos] = await Promise.all([
    contenedor.proyectos.repositorio.buscarPorId(id, sesion.usuarioId),
    contenedor.proyectos.listarTipos.ejecutar({ propietarioId: sesion.usuarioId }),
  ]);

  if (!proyecto) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar proyecto</h1>
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
