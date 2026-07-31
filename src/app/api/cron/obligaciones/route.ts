import { crearContenedor } from "@/di/container";
import { cronAutorizado, noAutorizado } from "../autorizacion";

/**
 * Tarea diaria de generacion de ocurrencias (Contexto.md §10.1, RF-52).
 *
 * Idempotente: correrla dos veces el mismo dia no duplica nada, porque el indice
 * unico `(obligacion_id, fecha_vencimiento)` de §6.3 lo impide y la funcion usa
 * `on conflict do nothing`.
 *
 * No hay sesion que comprobar: la credencial es CRON_SECRET (§9.3).
 */
export const dynamic = "force-dynamic";

export async function GET(peticion: Request): Promise<Response> {
  if (!(await cronAutorizado(peticion))) return noAutorizado();

  const contenedor = crearContenedor();
  const ajustes = await contenedor.ajustes.obtener();

  const { insertadas } = await contenedor.obligaciones.generarOcurrencias.ejecutar({
    horizonteMeses: ajustes.horizonteProyeccionMeses,
  });

  return Response.json({
    tarea: "generar-ocurrencias",
    horizonteMeses: ajustes.horizonteProyeccionMeses,
    insertadas,
  });
}
