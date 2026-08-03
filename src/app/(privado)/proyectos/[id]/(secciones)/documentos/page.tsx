import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { contenedorPrivado } from "@/di/container";
import { CabeceraSeccion } from "@/shared/ui/cabeceras";
import { ListaDocumentos } from "@/modules/documentos/presentation/components/lista-documentos";
import { SubidaDocumento } from "@/modules/documentos/presentation/components/subida-documento";

export const metadata: Metadata = { title: "Documentos del proyecto" };

type Props = { params: Promise<{ id: string }> };

/** RF-40 a RF-46 en el ámbito de un proyecto. */
export default async function PaginaDocumentosProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyecto = await contenedor.proyectos.obtener.buscar({ id });
  if (!proyecto) notFound();

  const documentos = await contenedor.documentos.listar.ejecutar({
    filtro: { proyectoId: id },
  });

  const deProyecto = documentos.filter((d) => d.movimientoId === null);
  const deMovimientos = documentos.filter((d) => d.movimientoId !== null);

  return (
    <div className="space-y-6">
      {/*
        Cabecera y pestañas en el layout de `(secciones)`. La frase sobre los
        enlaces firmados se dice UNA vez, en `/documentos`: estaba escrita con tres
        redacciones distintas en tres sitios para explicar el mismo hecho.
      */}
      <SubidaDocumento proyectoId={proyecto.id} etiqueta="Subir al proyecto" />

      <section className="space-y-3">
        <CabeceraSeccion
          titulo="Del proyecto"
          descripcion="Escrituras, contratos y documentos que no cuelgan de un movimiento."
        />
        <ListaDocumentos
          documentos={deProyecto}
          formatoFecha={ajustes.formatoFecha}
          ocultarProyecto
        />
      </section>

      {deMovimientos.length > 0 ? (
        <section className="space-y-3">
          <CabeceraSeccion
            titulo="Soportes de movimientos"
            descripcion={`${deMovimientos.length} archivo(s) adjuntos al registro de un movimiento.`}
          />
          <ListaDocumentos
            documentos={deMovimientos}
            formatoFecha={ajustes.formatoFecha}
            ocultarProyecto
          />
        </section>
      ) : null}
    </div>
  );
}
