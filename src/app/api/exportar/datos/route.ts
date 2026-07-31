import { contenedorPrivado } from "@/di/container";
import { traducirError } from "@/shared/presentation/ejecutar-accion";

/**
 * RF-103: exportación completa de los datos en JSON.
 *
 * Es una ruta y no una Server Action porque devuelve un archivo (§7.6). Exige
 * sesión como cualquier operación privada (§9.2).
 *
 * Va antes que `/api/exportar/[formato]` en resolución de rutas porque Next
 * prefiere el segmento estático sobre el dinámico; no hay ambigüedad que
 * resolver a mano.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const { contenedor } = await contenedorPrivado();
    const datos = await contenedor.reportes.exportarDatos.ejecutar();
    const nombre = `datos_${contenedor.reloj.hoy().replaceAll("-", "")}.json`;

    return new Response(JSON.stringify(datos, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${nombre}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const resultado = traducirError(error);
    const estado = !resultado.ok && resultado.codigo === "NO_AUTORIZADO" ? 401 : 500;
    return Response.json(
      { error: resultado.ok ? "Error inesperado." : resultado.mensaje },
      { status: estado },
    );
  }
}
