/**
 * PUERTO `AlmacenamientoArchivos` (Contexto.md §7.3).
 *
 * El dominio no sabe que detras hay Supabase Storage: solo que existe un sitio
 * donde se sube un archivo, del que se obtiene una URL firmada de vida corta
 * (RF-45) y del que se puede borrar un objeto (RF-46).
 */
export interface AlmacenamientoArchivos {
  subir(entrada: {
    ruta: string;
    contenido: ArrayBuffer | Uint8Array;
    mimeType: string;
  }): Promise<void>;

  /** URL temporal. `segundos` por omision 3600 (RF-45). */
  urlFirmada(ruta: string, segundos?: number): Promise<string>;

  eliminar(ruta: string): Promise<void>;
}

/** Vigencia de la firma: 60 minutos (RF-45). */
export const VIGENCIA_FIRMA_SEGUNDOS = 3600;
