import { FileImage, FileSpreadsheet, FileText, FileType } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { ETIQUETA_TIPO_DOCUMENTO } from "@/shared/utils/etiquetas";
import { formatearFecha, formatearTamano } from "@/shared/utils/formato";
import type { DocumentoListado } from "../../domain/documento.repository";
import { AccionesDocumento } from "./acciones-documento";

type Props = {
  documentos: DocumentoListado[];
  formatoFecha?: string;
  ocultarProyecto?: boolean;
};

function Icono({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="size-4" aria-hidden />;
  if (mimeType === "application/pdf") return <FileText className="size-4" aria-hidden />;
  if (mimeType.includes("spreadsheet")) return <FileSpreadsheet className="size-4" aria-hidden />;
  return <FileType className="size-4" aria-hidden />;
}

/** RF-43, RF-47: metadatos visibles de cada soporte. */
export function ListaDocumentos({ documentos, formatoFecha, ocultarProyecto }: Props) {
  if (documentos.length === 0) {
    return (
      <EstadoVacio
        icono={<FileText className="size-8" />}
        titulo="Sin soportes"
        descripcion="Adjunta escrituras, contratos, facturas o fotografías para tenerlos siempre a mano."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {documentos.map((documento) => (
        <li key={documento.id} className="panel flex items-start gap-3 p-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon/15 to-neon-2/15 text-neon"
          >
            <Icono mimeType={documento.mimeType} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={documento.nombreArchivo}>
              {documento.nombreArchivo}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ocultarProyecto ? "" : `${documento.proyectoNombre} · `}
              {formatearFecha(documento.cargadoEn.slice(0, 10), formatoFecha)} ·{" "}
              {formatearTamano(documento.tamanoBytes)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{ETIQUETA_TIPO_DOCUMENTO[documento.tipoDocumento]}</Badge>
              {documento.movimientoDescripcion ? (
                <Badge variant="outline" className="max-w-40 truncate">
                  {documento.movimientoDescripcion}
                </Badge>
              ) : null}
            </div>
          </div>

          <AccionesDocumento
            id={documento.id}
            nombreArchivo={documento.nombreArchivo}
            esPrevisualizable={documento.esPrevisualizable}
            esImagen={documento.esImagen}
          />
        </li>
      ))}
    </ul>
  );
}
