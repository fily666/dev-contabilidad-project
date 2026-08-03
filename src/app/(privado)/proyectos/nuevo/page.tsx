import type { Metadata } from "next";
import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { FormularioProyecto } from "@/modules/proyectos/presentation/components/formulario-proyecto";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function PaginaNuevoProyecto() {
  const { contenedor } = await contenedorPrivado();
  const tipos = await contenedor.proyectos.listarTipos.ejecutar();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CabeceraPagina
        ambito="Cartera"
        titulo="Nuevo proyecto"
        descripcion="El tipo decide las categorías sugeridas, los indicadores visibles y los atributos propios del activo."
      />
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
