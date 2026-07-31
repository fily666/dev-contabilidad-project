import type { TipoDocumento } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Documento } from "./documento.entity";

/** PUERTO `DocumentoRepository` (Contexto.md §7.3). */

/** RF-47: busqueda por proyecto, tipo, rango de fechas y nombre. */
export type FiltroDocumentos = {
  proyectoId?: string;
  movimientoId?: string;
  /** `true` para los soportes de proyecto (sin movimiento asociado, RF-41). */
  soloDeProyecto?: boolean;
  tipos?: TipoDocumento[];
  desde?: FechaIso;
  hasta?: FechaIso;
  texto?: string;
};

export type DocumentoListado = {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  movimientoId: string | null;
  movimientoDescripcion: string | null;
  nombreArchivo: string;
  tipoDocumento: TipoDocumento;
  mimeType: string;
  tamanoBytes: number;
  cargadoEn: string;
  esPrevisualizable: boolean;
  esImagen: boolean;
};

export interface DocumentoRepository {
  buscarPorId(id: string): Promise<Documento | null>;
  /** Excluye siempre los eliminados logicamente (ADR-12). */
  listar(filtro?: FiltroDocumentos): Promise<DocumentoListado[]>;
  guardar(documento: Documento): Promise<Documento>;
  /** Persiste el borrado logico. */
  actualizar(documento: Documento): Promise<Documento>;
  contarPorProyecto(proyectoId: string): Promise<number>;
  /** RF-40: cuantos soportes vivos cuelgan ya del movimiento. */
  contarPorMovimiento(movimientoId: string): Promise<number>;
}
