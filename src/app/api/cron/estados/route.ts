import { crearContenedor } from "@/di/container";
import { cronAutorizado, noAutorizado } from "../autorizacion";

/**
 * Tarea diaria de sincronizacion de vencidos (Contexto.md §10.1, RF-25, RF-55).
 *
 * Pasa a `vencido` los movimientos y a `vencida` las ocurrencias que siguen
 * pendientes con fecha anterior a hoy. La interfaz ya los presenta asi sin
 * esperar a esta tarea (RF-25), pero la columna persistida es la que usan los
 * filtros y los reportes, y debe acabar coincidiendo.
 */
export const dynamic = "force-dynamic";

export async function GET(peticion: Request): Promise<Response> {
  if (!(await cronAutorizado(peticion))) return noAutorizado();

  const contenedor = crearContenedor();
  const { actualizados } = await contenedor.obligaciones.actualizarEstadosVencidos.ejecutar();

  return Response.json({ tarea: "marcar-vencidos", actualizados });
}
