import { Suspense } from "react";
import type { Metadata } from "next";
import { FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { FiltrosDocumentos } from "@/modules/documentos/presentation/components/filtros-documentos";
import { ListaDocumentos } from "@/modules/documentos/presentation/components/lista-documentos";
import {
  leerFiltrosDocumentos,
  type ParametrosBusqueda,
} from "@/modules/documentos/presentation/leer-filtros";

export const metadata: Metadata = { title: "Documentos" };

type Props = { searchParams: Promise<ParametrosBusqueda> };

/** RF-47: búsqueda documental transversal a todos los proyectos. */
export default async function PaginaDocumentos({ searchParams }: Props) {
  const parametros = await searchParams;
  const filtro = leerFiltrosDocumentos(parametros);
  const { contenedor, ajustes } = await contenedorPrivado();

  const [documentos, proyectos] = await Promise.all([
    contenedor.documentos.listar.ejecutar({ filtro }),
    contenedor.proyectos.listar.ejecutar({}),
  ]);

  const tamanoTotal = documentos.reduce((suma, d) => suma + d.tamanoBytes, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta-dato">Soportes</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Escrituras, contratos, facturas y comprobantes de todos los proyectos. Los archivos se
          sirven con enlaces firmados temporales.
        </p>
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="Los soportes se adjuntan a un proyecto o a uno de sus movimientos."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <FiltrosDocumentos
              proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
            />
          </Suspense>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {documentos.length} soporte(s) · {(tamanoTotal / (1024 * 1024)).toFixed(1)} MB
            </p>
            <p className="text-xs text-muted-foreground">
              Para subir un soporte entra al proyecto o al movimiento correspondiente.
            </p>
          </div>

          <ListaDocumentos documentos={documentos} formatoFecha={ajustes.formatoFecha} />
        </>
      )}
    </div>
  );
}
