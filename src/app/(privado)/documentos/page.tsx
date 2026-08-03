import { Suspense } from "react";
import type { Metadata } from "next";
import { FolderPlus, Upload } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina, CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatearTamano } from "@/shared/utils/formato";
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
  const proyectoFiltrado = filtro.proyectoId
    ? (proyectos.find((p) => p.proyectoId === filtro.proyectoId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Soportes"
        titulo="Documentos"
        descripcion="Escrituras, contratos, facturas y comprobantes de todos los proyectos. Los archivos se sirven con enlaces firmados temporales."
        // La subida vive en el ámbito del proyecto, porque un soporte sin proyecto
        // no existe (§5.7). Con un proyecto ya filtrado, el destino es inequívoco:
        // antes esta vista se limitaba a decir «entra al proyecto correspondiente»
        // y dejaba al usuario buscarlo por su cuenta.
        acciones={
          proyectoFiltrado ? (
            <EnlaceBoton href={`/proyectos/${proyectoFiltrado.proyectoId}/documentos`}>
              <Upload className="size-4" aria-hidden /> Subir a {proyectoFiltrado.nombre}
            </EnlaceBoton>
          ) : null
        }
      />

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

          {/*
            Una cabecera de sección con el recuento, en lugar de dos párrafos
            sueltos enfrentados. El de la derecha —«para subir un soporte entra al
            proyecto o al movimiento correspondiente»— era una instrucción sin
            enlace: mandaba al usuario a buscar a mano el destino que la propia
            vista ya conocía. Ahora es el botón de la cabecera, y el tamaño usa el
            mismo `formatearTamano` que cada tarjeta de la lista en lugar de una
            división por 1024 escrita aquí.
          */}
          <CabeceraSeccion
            titulo="Resultados"
            descripcion={`${documentos.length} soporte(s) · ${formatearTamano(tamanoTotal)}`}
          />

          <ListaDocumentos documentos={documentos} formatoFecha={ajustes.formatoFecha} />
        </>
      )}
    </div>
  );
}
