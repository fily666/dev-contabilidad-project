import { contenedorPrivado } from "@/di/container";
import { traducirError } from "@/shared/presentation/ejecutar-accion";
import { leerFiltroReporte } from "@/modules/reportes/presentation/leer-filtros";

/**
 * RF-94, RF-95: exportacion de reportes a Excel y PDF (§11).
 *
 * Es una API Route y no una Server Action porque devuelve un archivo: las Server
 * Actions estan para mutar (§7.6). La sesion se comprueba con `contenedorPrivado`,
 * igual que en cualquier otra operacion privada (§9.2) — el middleware protege
 * navegaciones y esto es una descarga que el navegador pide como navegacion, asi
 * que las dos superficies aplican y ninguna sobra.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ formato: string }> };

export async function GET(peticion: Request, { params }: Props): Promise<Response> {
  const { formato } = await params;
  if (formato !== "excel" && formato !== "pdf") {
    return Response.json({ error: "Formato no soportado." }, { status: 404 });
  }

  try {
    const { contenedor } = await contenedorPrivado();
    const url = new URL(peticion.url);
    const { tipo, filtro } = leerFiltroReporte(Object.fromEntries(url.searchParams.entries()));

    // El nombre del proyecto va en el nombre del archivo y en el encabezado del
    // reporte, asi que se resuelve antes de armarlo (§11).
    const proyecto = filtro.proyectoId
      ? await contenedor.proyectos.obtener.buscar({ id: filtro.proyectoId })
      : null;

    const armador = contenedor.reportes[tipo];
    const reporte = await armador.ejecutar({
      filtro: { ...filtro, proyectoNombre: proyecto?.nombre ?? null },
    });

    const { bytes, nombre, mimeType } = await contenedor.reportes.exportar.ejecutar({
      reporte,
      formato,
      proyectoNombre: proyecto?.nombre ?? null,
    });

    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "content-type": mimeType,
        "content-disposition": `attachment; filename="${nombre}"`,
        "content-length": String(bytes.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const resultado = traducirError(error);
    const estado = resultado.ok
      ? 500
      : resultado.codigo === "NO_AUTENTICADO" || resultado.codigo === "NO_AUTORIZADO"
        ? 401
        : resultado.codigo === "EXPORTACION_DEMASIADO_GRANDE"
          ? 413
          : 500;

    return Response.json(
      { error: resultado.ok ? "Error inesperado." : resultado.mensaje },
      { status: estado },
    );
  }
}
