import type { Metadata } from "next";
import { contenedorPrivado } from "@/di/container";
import { FormularioProyecto } from "@/modules/proyectos/presentation/components/formulario-proyecto";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function PaginaNuevoProyecto() {
  const { contenedor } = await contenedorPrivado();
  const tipos = await contenedor.proyectos.listarTipos.ejecutar();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="etiqueta-dato">Cartera</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
      </div>
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
