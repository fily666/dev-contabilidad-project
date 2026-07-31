import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import {
  VIGENCIA_FIRMA_SEGUNDOS,
  type AlmacenamientoArchivos,
} from "@/modules/documentos/domain/almacenamiento";

/** Bucket privado de §6.7. */
export const BUCKET_SOPORTES = "soportes";

/**
 * ADAPTADOR del puerto AlmacenamientoArchivos sobre Supabase Storage (§7.3).
 *
 * Lleva `import "server-only"`: opera el bucket con `service_role` y el bucket es
 * privado sin politicas, asi que todo acceso al archivo pasa por una URL firmada
 * generada aqui (§6.7, §9.3). Si un componente de cliente importara este modulo,
 * la compilacion falla en lugar de filtrar la clave.
 */
export class SupabaseAlmacenamiento implements AlmacenamientoArchivos {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async subir(entrada: {
    ruta: string;
    contenido: ArrayBuffer | Uint8Array;
    mimeType: string;
  }): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET_SOPORTES)
      .upload(entrada.ruta, entrada.contenido, {
        contentType: entrada.mimeType,
        // Sin sobreescritura: la ruta lleva el uuid del documento, asi que una
        // colision significaria que algo se esta reintentando mal, y es mejor
        // saberlo que perder el archivo anterior.
        upsert: false,
      });

    if (error) throw error;
  }

  /** RF-45: URL temporal; los archivos nunca son publicos. */
  async urlFirmada(ruta: string, segundos = VIGENCIA_FIRMA_SEGUNDOS): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_SOPORTES)
      .createSignedUrl(ruta, segundos);

    if (error) throw error;
    if (!data?.signedUrl) {
      throw new Error(`No se pudo firmar la URL del soporte ${ruta}.`);
    }
    return data.signedUrl;
  }

  async eliminar(ruta: string): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET_SOPORTES).remove([ruta]);
    if (error) throw error;
  }
}
