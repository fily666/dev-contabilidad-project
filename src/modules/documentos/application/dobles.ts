import type { AlmacenamientoArchivos } from "../domain/almacenamiento";
import type { Documento } from "../domain/documento.entity";
import type {
  DocumentoListado,
  DocumentoRepository,
  FiltroDocumentos,
} from "../domain/documento.repository";

/** Dobles en memoria de los puertos documentales (Contexto.md §8.8). */

export class DocumentoRepositoryEnMemoria implements DocumentoRepository {
  readonly filas = new Map<string, Documento>();
  /** Simula un fallo al escribir la fila, para probar la compensacion. */
  fallarAlGuardar = false;

  async buscarPorId(id: string): Promise<Documento | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(filtro: FiltroDocumentos = {}): Promise<DocumentoListado[]> {
    return [...this.filas.values()]
      .filter((d) => !d.eliminado)
      .filter((d) => !filtro.proyectoId || d.proyectoId === filtro.proyectoId)
      .filter((d) => !filtro.movimientoId || d.movimientoId === filtro.movimientoId)
      .filter((d) => !filtro.soloDeProyecto || d.movimientoId === null)
      .filter((d) => !filtro.tipos?.length || filtro.tipos.includes(d.tipoDocumento))
      .filter(
        (d) => !filtro.texto || d.nombreArchivo.toLowerCase().includes(filtro.texto.toLowerCase()),
      )
      .map((d) => ({
        id: d.id,
        proyectoId: d.proyectoId,
        proyectoNombre: "Proyecto",
        movimientoId: d.movimientoId,
        movimientoDescripcion: null,
        nombreArchivo: d.nombreArchivo,
        tipoDocumento: d.tipoDocumento,
        mimeType: d.mimeType,
        tamanoBytes: d.tamanoBytes,
        cargadoEn: d.aDatos().cargadoEn,
        esPrevisualizable: d.esPrevisualizable,
        esImagen: d.esImagen,
      }));
  }

  async guardar(documento: Documento): Promise<Documento> {
    if (this.fallarAlGuardar) throw new Error("fallo simulado al escribir la fila");
    this.filas.set(documento.id, documento);
    return documento;
  }

  async actualizar(documento: Documento): Promise<Documento> {
    this.filas.set(documento.id, documento);
    return documento;
  }

  async contarPorProyecto(proyectoId: string): Promise<number> {
    return [...this.filas.values()].filter((d) => d.proyectoId === proyectoId && !d.eliminado)
      .length;
  }
}

export class AlmacenamientoEnMemoria implements AlmacenamientoArchivos {
  readonly objetos = new Map<string, { mimeType: string; bytes: number }>();
  firmas: Array<{ ruta: string; segundos: number }> = [];

  async subir(entrada: {
    ruta: string;
    contenido: ArrayBuffer | Uint8Array;
    mimeType: string;
  }): Promise<void> {
    const bytes =
      entrada.contenido instanceof Uint8Array
        ? entrada.contenido.byteLength
        : entrada.contenido.byteLength;
    this.objetos.set(entrada.ruta, { mimeType: entrada.mimeType, bytes });
  }

  async urlFirmada(ruta: string, segundos = 3600): Promise<string> {
    if (!this.objetos.has(ruta)) throw new Error(`objeto inexistente: ${ruta}`);
    this.firmas.push({ ruta, segundos });
    return `https://almacenamiento.local/${ruta}?firma=simulada&expira=${segundos}`;
  }

  async eliminar(ruta: string): Promise<void> {
    this.objetos.delete(ruta);
  }
}
