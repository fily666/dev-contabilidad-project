import { NoEncontrado } from "@/shared/domain/errores";
import type { TipoDocumento } from "@/shared/domain/enumeraciones";
import type { Reloj } from "@/shared/domain/reloj";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";

import { VIGENCIA_FIRMA_SEGUNDOS, type AlmacenamientoArchivos } from "../domain/almacenamiento";
import { Documento, construirRutaStorage } from "../domain/documento.entity";
import type {
  DocumentoListado,
  DocumentoRepository,
  FiltroDocumentos,
} from "../domain/documento.repository";

/** Casos de uso de gestion documental (Contexto.md RF-40 a RF-47). */

export type EntradaSubirDocumento = {
  proyectoId: string;
  movimientoId?: string | null;
  nombreArchivo: string;
  /** Nombre ya saneado para la ruta de Storage (§6.7). */
  nombreSeguro: string;
  mimeType: string;
  tamanoBytes: number;
  contenido: ArrayBuffer | Uint8Array;
  tipoDocumento?: TipoDocumento;
};

/**
 * RF-40, RF-41, RF-42, RF-43.
 *
 * Orden deliberado: primero se validan los metadatos en la entidad, luego se
 * sube el objeto y solo al final se escribe la fila. Si la escritura falla, el
 * objeto se borra: es preferible un bucket limpio a un archivo huerfano que
 * nadie puede ver ni eliminar desde la interfaz.
 */
export class SubirDocumento {
  constructor(
    private readonly documentos: DocumentoRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly almacenamiento: AlmacenamientoArchivos,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaSubirDocumento): Promise<Documento> {
    const proyecto = await this.proyectos.buscarPorId(entrada.proyectoId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.proyectoId);

    const id = this.nuevoId();
    const ruta = construirRutaStorage({
      proyectoId: proyecto.id,
      id,
      nombreSeguro: entrada.nombreSeguro,
    });

    const documento = Documento.crear({
      id,
      proyectoId: proyecto.id,
      movimientoId: entrada.movimientoId,
      nombreArchivo: entrada.nombreArchivo,
      rutaStorage: ruta,
      tipoDocumento: entrada.tipoDocumento,
      mimeType: entrada.mimeType,
      tamanoBytes: entrada.tamanoBytes,
      cargadoEn: this.reloj.ahora().toISOString(),
    });

    await this.almacenamiento.subir({
      ruta,
      contenido: entrada.contenido,
      mimeType: entrada.mimeType,
    });

    try {
      return await this.documentos.guardar(documento);
    } catch (error) {
      await this.almacenamiento.eliminar(ruta).catch(() => undefined);
      throw error;
    }
  }
}

/** RF-47. */
export class ListarDocumentos {
  constructor(private readonly documentos: DocumentoRepository) {}

  async ejecutar(entrada: { filtro?: FiltroDocumentos } = {}): Promise<DocumentoListado[]> {
    return this.documentos.listar(entrada.filtro);
  }
}

/** RF-44, RF-45: la URL firmada es el unico camino al archivo. */
export class ObtenerUrlDocumento {
  constructor(
    private readonly documentos: DocumentoRepository,
    private readonly almacenamiento: AlmacenamientoArchivos,
  ) {}

  async ejecutar(entrada: {
    id: string;
    segundos?: number;
  }): Promise<{ url: string; nombreArchivo: string; mimeType: string; expiraEn: number }> {
    const documento = await this.documentos.buscarPorId(entrada.id);
    if (!documento || documento.eliminado) throw new NoEncontrado("documento", entrada.id);

    const segundos = entrada.segundos ?? VIGENCIA_FIRMA_SEGUNDOS;
    return {
      url: await this.almacenamiento.urlFirmada(documento.rutaStorage, segundos),
      nombreArchivo: documento.nombreArchivo,
      mimeType: documento.mimeType,
      expiraEn: segundos,
    };
  }
}

/**
 * RF-46: borrado logico en base y borrado real del objeto.
 *
 * La fila se marca primero. Si el borrado del objeto falla, la interfaz ya no
 * muestra el soporte y queda un objeto sin referencia —molesto pero inocuo—; al
 * revés se perderia el archivo con la fila viva apuntando a la nada.
 */
export class EliminarDocumento {
  constructor(
    private readonly documentos: DocumentoRepository,
    private readonly almacenamiento: AlmacenamientoArchivos,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: {
    id: string;
  }): Promise<{ proyectoId: string; movimientoId: string | null }> {
    const documento = await this.documentos.buscarPorId(entrada.id);
    if (!documento || documento.eliminado) throw new NoEncontrado("documento", entrada.id);

    documento.eliminar(this.reloj.ahora().toISOString());
    await this.documentos.actualizar(documento);
    await this.almacenamiento.eliminar(documento.rutaStorage);

    return { proyectoId: documento.proyectoId, movimientoId: documento.movimientoId };
  }
}
