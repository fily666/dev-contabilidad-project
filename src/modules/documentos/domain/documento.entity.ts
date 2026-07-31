import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { TipoDocumento } from "@/shared/domain/enumeraciones";

export type DatosDocumento = {
  id: string;
  proyectoId: string;
  /** Soporte de un movimiento (RF-40) o del proyecto entero (RF-41). */
  movimientoId: string | null;
  nombreArchivo: string;
  rutaStorage: string;
  tipoDocumento: TipoDocumento;
  mimeType: string;
  tamanoBytes: number;
  cargadoEn: string;
  /** Borrado logico (ADR-12, RF-46). */
  eliminadoEn: string | null;
};

/** RF-42: tipos admitidos y su extension, para el `accept` del formulario. */
export const MIMES_PERMITIDOS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

/** RF-42: 20 MB. Es el mismo limite del bucket y del `check` de la tabla. */
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

/** Texto unico del limite, para que los tres mensajes no se desincronicen. */
export const TAMANO_MAXIMO_LEGIBLE = `${TAMANO_MAXIMO_BYTES / 1024 / 1024} MB`;

/**
 * RF-40: cuantos soportes admite un movimiento.
 *
 * Un pago se justifica con el comprobante y a lo sumo unos anexos; sin tope, un
 * solo movimiento podria llenar el bucket.
 */
export const MAXIMO_SOPORTES_POR_MOVIMIENTO = 7;

/**
 * Subconjunto admitido como comprobante de pago (RF-40). El catalogo general
 * incluye ademas hojas de calculo y documentos de texto, que sirven como
 * soporte de proyecto (RF-41) pero no como prueba de un pago.
 */
export const MIMES_COMPROBANTE: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Los que se pueden previsualizar en linea (RF-44). Hoy coinciden con
 * `MIMES_COMPROBANTE`, pero son reglas distintas: una habla de que se puede
 * mostrar en el navegador y la otra de que se acepta como prueba de pago.
 */
const MIMES_PREVISUALIZABLES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Soporte documental (Contexto.md RF-40 a RF-46).
 *
 * El archivo vive en Storage; esta entidad es su metadato y la unica que conoce
 * las reglas de tipo y tamaño. Se validan aqui, en el bucket y en la tabla: tres
 * capas para el mismo limite, porque el archivo llega del navegador (§8.7).
 */
export class Documento {
  private constructor(private datos: DatosDocumento) {}

  static crear(entrada: {
    id: string;
    proyectoId: string;
    movimientoId?: string | null;
    nombreArchivo: string;
    rutaStorage: string;
    tipoDocumento?: TipoDocumento;
    mimeType: string;
    tamanoBytes: number;
    cargadoEn: string;
  }): Documento {
    return new Documento({
      id: entrada.id,
      proyectoId: entrada.proyectoId,
      movimientoId: entrada.movimientoId ?? null,
      nombreArchivo: validarNombre(entrada.nombreArchivo),
      rutaStorage: entrada.rutaStorage,
      tipoDocumento: entrada.tipoDocumento ?? "otro",
      mimeType: validarMime(entrada.mimeType),
      tamanoBytes: validarTamano(entrada.tamanoBytes),
      cargadoEn: entrada.cargadoEn,
      eliminadoEn: null,
    });
  }

  static desdePersistencia(datos: DatosDocumento): Documento {
    return new Documento(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get proyectoId(): string {
    return this.datos.proyectoId;
  }
  get movimientoId(): string | null {
    return this.datos.movimientoId;
  }
  get nombreArchivo(): string {
    return this.datos.nombreArchivo;
  }
  get rutaStorage(): string {
    return this.datos.rutaStorage;
  }
  get tipoDocumento(): TipoDocumento {
    return this.datos.tipoDocumento;
  }
  get mimeType(): string {
    return this.datos.mimeType;
  }
  get tamanoBytes(): number {
    return this.datos.tamanoBytes;
  }
  get eliminado(): boolean {
    return this.datos.eliminadoEn !== null;
  }

  /** RF-44. */
  get esPrevisualizable(): boolean {
    return MIMES_PREVISUALIZABLES.includes(this.datos.mimeType);
  }

  get esImagen(): boolean {
    return this.datos.mimeType.startsWith("image/");
  }

  /** RF-46: borrado logico del metadato; el objeto se borra en el adaptador. */
  eliminar(ahora: string): void {
    if (this.datos.eliminadoEn !== null) {
      throw new ReglaDeNegocioViolada("DOCUMENTO_ELIMINADO", "El soporte ya estaba eliminado.");
    }
    this.datos.eliminadoEn = ahora;
  }

  aDatos(): DatosDocumento {
    return { ...this.datos };
  }
}

/**
 * Ruta en Storage: `{proyecto_id}/{uuid}-{slug}` (§6.7). El uuid delante del
 * nombre evita que dos archivos con el mismo nombre choquen, y el slug conserva
 * algo legible para quien mire el bucket.
 */
export function construirRutaStorage(entrada: {
  proyectoId: string;
  id: string;
  nombreSeguro: string;
}): string {
  return `${entrada.proyectoId}/${entrada.id}-${entrada.nombreSeguro}`;
}

function validarNombre(valor: string): string {
  const nombre = valor.trim();
  if (nombre.length < 1 || nombre.length > 255) {
    throw new ReglaDeNegocioViolada(
      "NOMBRE_ARCHIVO_INVALIDO",
      "El nombre del archivo debe tener entre 1 y 255 caracteres.",
      "archivo",
    );
  }
  return nombre;
}

function validarMime(valor: string): string {
  if (!Object.hasOwn(MIMES_PERMITIDOS, valor)) {
    throw new ReglaDeNegocioViolada(
      "TIPO_ARCHIVO_NO_PERMITIDO",
      "Solo se admiten PDF, JPG, PNG, WEBP, XLSX y DOCX.",
      "archivo",
    );
  }
  return valor;
}

function validarTamano(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ReglaDeNegocioViolada(
      "ARCHIVO_VACIO",
      "El archivo está vacío o no se pudo leer.",
      "archivo",
    );
  }
  if (valor > TAMANO_MAXIMO_BYTES) {
    throw new ReglaDeNegocioViolada(
      "ARCHIVO_DEMASIADO_GRANDE",
      `El archivo supera el máximo de ${TAMANO_MAXIMO_LEGIBLE}.`,
      "archivo",
    );
  }
  return valor;
}
