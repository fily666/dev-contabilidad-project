import type { Metadata } from "next";
import { contenedorAutenticado } from "@/di/container";
import { FormularioProyecto } from "@/modules/proyectos/presentation/components/formulario-proyecto";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function PaginaNuevoProyecto() {
  const { contenedor, sesion } = await contenedorAutenticado();
  const tipos = await contenedor.proyectos.listarTipos.ejecutar({
    propietarioId: sesion.usuarioId,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
      <FormularioProyecto
        hoy={contenedor.reloj.hoy()}
        tipos={tipos.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          configuracion: t.configuracion,
        }))}
      />
    </div>
  );
}
