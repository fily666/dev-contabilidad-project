import { crearContenedor } from "@/di/container";
import { cronAutorizado, noAutorizado } from "../autorizacion";

/**
 * Tareas de notificaciones (Contexto.md §10.1, RF-53).
 *
 *   GET /api/cron/notificaciones           → programa los avisos del horizonte
 *   GET /api/cron/notificaciones?enviar=1  → envía la cola pendiente
 *
 * Son dos tareas y un solo endpoint porque comparten toda la configuración y se
 * diferencian en una sola decisión. Las dos son idempotentes: programar dos veces
 * el mismo aviso lo descarta el índice único de §6.3, y enviar dos veces no
 * duplica correos porque la fila ya quedó en `enviada`.
 */
export const dynamic = "force-dynamic";

export async function GET(peticion: Request): Promise<Response> {
  if (!(await cronAutorizado(peticion))) return noAutorizado();

  const contenedor = crearContenedor();
  const ajustes = await contenedor.ajustes.obtener();
  const enviar = new URL(peticion.url).searchParams.get("enviar") === "1";

  if (enviar) {
    const resultado = await contenedor.notificaciones.enviar.ejecutar({
      emailDestino: ajustes.emailDestino,
    });
    return Response.json({ tarea: "enviar-notificaciones", ...resultado });
  }

  const configuracion = {
    canales: ajustes.canalesNotificacion,
    diasAviso: ajustes.diasAvisoPorOmision,
    emailDestino: ajustes.emailDestino,
    urlBase: process.env.NEXT_PUBLIC_APP_URL ?? "",
  };

  const [avisos, resumen] = await Promise.all([
    contenedor.notificaciones.programar.ejecutar({ configuracion }),
    // El resumen semanal se programa los lunes (§10.3); el resto de los días la
    // llamada existe pero no encuentra nada que hacer.
    contenedor.reloj.ahora().getUTCDay() === 1
      ? contenedor.notificaciones.programar.programarResumen({ configuracion })
      : Promise.resolve({ programado: false }),
  ]);

  return Response.json({
    tarea: "programar-avisos",
    canales: configuracion.canales,
    ...avisos,
    resumenSemanal: resumen.programado,
  });
}
