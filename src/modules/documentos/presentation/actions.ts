"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import { slug } from "@/shared/utils/formato";
import { esquemaDocumentoPorId, esquemaSubirComprobante, esquemaSubirDocumento } from "./schemas";

function revalidar(proyectoId?: string, movimientoId?: string | null) {
  revalidatePath("/documentos");
  if (proyectoId) {
    revalidatePath(`/proyectos/${proyectoId}`);
    revalidatePath(`/proyectos/${proyectoId}/documentos`);
  }
  if (movimientoId) revalidatePath("/movimientos");
}

/**
 * RF-40 a RF-43. Recibe el FormData tal cual porque el archivo es un `File`, y
 * eso no sobrevive a una serializacion a objeto plano.
 */
export async function subirDocumentoAction(datos: FormData): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();

  const entrada = {
    proyectoId: datos.get("proyectoId"),
    movimientoId: datos.get("movimientoId"),
    tipoDocumento: datos.get("tipoDocumento") ?? undefined,
    archivo: datos.get("archivo"),
  };

  return ejecutarAccion(esquemaSubirDocumento, entrada, async (valido) => {
    const documento = await contenedor.documentos.subir.ejecutar({
      proyectoId: valido.proyectoId,
      movimientoId: valido.movimientoId,
      nombreArchivo: valido.archivo.name,
      nombreSeguro: slug(valido.archivo.name) || "soporte",
      mimeType: valido.archivo.type,
      tamanoBytes: valido.archivo.size,
      contenido: await valido.archivo.arrayBuffer(),
      tipoDocumento: valido.tipoDocumento,
    });

    revalidar(documento.proyectoId, documento.movimientoId);
    return { id: documento.id };
  });
}

/**
 * RF-40: soporte adjuntado desde el formulario de un movimiento.
 *
 * Se sube un archivo por llamada. Enviar los siete en un solo cuerpo obligaria a
 * subir el `bodySizeLimit` de las Server Actions a 140 MB, y un fallo a mitad de
 * camino se llevaria por delante los que ya habian pasado.
 */
export async function subirComprobanteAction(datos: FormData): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();

  const entrada = {
    proyectoId: datos.get("proyectoId"),
    movimientoId: datos.get("movimientoId"),
    tipoDocumento: datos.get("tipoDocumento") ?? undefined,
    archivo: datos.get("archivo"),
  };

  return ejecutarAccion(esquemaSubirComprobante, entrada, async (valido) => {
    const documento = await contenedor.documentos.subir.ejecutar({
      proyectoId: valido.proyectoId,
      movimientoId: valido.movimientoId,
      nombreArchivo: valido.archivo.name,
      nombreSeguro: slug(valido.archivo.name) || "soporte",
      mimeType: valido.archivo.type,
      tamanoBytes: valido.archivo.size,
      contenido: await valido.archivo.arrayBuffer(),
      tipoDocumento: valido.tipoDocumento,
    });

    revalidar(documento.proyectoId, documento.movimientoId);
    return { id: documento.id };
  });
}

/**
 * RF-44, RF-45: devuelve una URL firmada de 60 minutos. No se devuelve nunca la
 * ruta del bucket: sin firma responde 403 y asi debe seguir.
 */
export async function urlDocumentoAction(
  datos: unknown,
): Promise<Resultado<{ url: string; nombreArchivo: string; mimeType: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaDocumentoPorId, datos, async (entrada) => {
    const { url, nombreArchivo, mimeType } = await contenedor.documentos.url.ejecutar(entrada);
    return { url, nombreArchivo, mimeType };
  });
}

/** RF-46. */
export async function eliminarDocumentoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaDocumentoPorId, datos, async (entrada) => {
    const { proyectoId, movimientoId } = await contenedor.documentos.eliminar.ejecutar(entrada);
    revalidar(proyectoId, movimientoId);
    return { id: entrada.id };
  });
}
