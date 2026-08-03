import { crearContenedor } from "@/di/container";
import { cronAutorizado, noAutorizado } from "../autorizacion";

/**
 * Sincronizacion de vencidos (Contexto.md §10.1, RF-25, RF-55).
 *
 * **Disparador manual: el horario vive en pg_cron, no aqui.** La tarea diaria la
 * programa la base (`marcar-vencidos`, §10.1); `marcar_vencidos()` es una
 * funcion SQL y este endpoint solo la invocaba.
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
