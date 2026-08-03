import { crearContenedor } from "@/di/container";
import { cronAutorizado, noAutorizado } from "../autorizacion";

/**
 * Generacion de ocurrencias (Contexto.md §10.1, RF-52).
 *
 * **Disparador manual: el horario vive en pg_cron, no aqui.** La tarea diaria la
 * programa la base (`generar-ocurrencias`, §10.1) porque `generar_ocurrencias()`
 * es una funcion SQL y no necesita este runtime para nada. Esta ruta se queda
 * para poblar una base recien sembrada a mano, que es lo que hace el README.
 *
 * Idempotente: correrla dos veces el mismo dia no duplica nada, porque el indice
 * unico `(obligacion_id, fecha_vencimiento)` de §6.3 lo impide y la funcion usa
 * `on conflict do nothing`. Por eso dispararla a mano junto a la tarea de la
 * base es inofensivo.
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
