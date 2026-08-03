import type { Metadata } from "next";
import { ArrowLeft, FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { ImportadorCsv } from "@/modules/movimientos/presentation/components/importador-csv";

export const metadata: Metadata = { title: "Importar movimientos" };

/** RF-27. */
export default async function PaginaImportarMovimientos() {
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyectos = await contenedor.proyectos.listar.ejecutar({
    filtro: { estados: ["activo", "pausado"] },
  });

  return (
    <div className="space-y-6">
      <div>
        {/*
          `sm:hidden`, como el de las secciones de proyecto: desde 640 px la miga
          de pan de la barra superior ya dice «Movimientos › Importar» y es
          navegable, así que este botón era el segundo camino de vuelta al mismo
          sitio, uno encima del otro.
        */}
        <EnlaceBoton href="/movimientos" variant="ghost" size="sm" className="mb-2 -ml-2 sm:hidden">
          <ArrowLeft className="size-4" aria-hidden /> Movimientos
        </EnlaceBoton>

        <CabeceraPagina
          ambito="Carga en lote"
          titulo="Importar movimientos"
          descripcion="Se valida fila por fila y se previsualiza antes de escribir. Las categorías y los métodos de pago se buscan por nombre; los que no existan se señalan sin detener el resto."
        />
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="Los movimientos importados necesitan un proyecto al que pertenecer."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <ImportadorCsv
          proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
          moneda={proyectos[0]?.moneda ?? ajustes.moneda}
        />
      )}
    </div>
  );
}
