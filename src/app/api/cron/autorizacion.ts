import "server-only";

/**
 * Guardia de las tareas programadas (Contexto.md §9.3, §10.1).
 *
 * Los endpoints de cron no tienen sesion: los invoca Vercel, no un navegador.
 * Su unica credencial es `CRON_SECRET` en el encabezado `Authorization`.
 *
 * La comparacion es de digestos en tiempo constante, por la misma razon que la
 * del token de acceso (§9.1): comparar cadenas filtra por tiempo cuantos
 * caracteres iniciales acertó quien lo intenta.
 */
async function digesto(valor: string): Promise<Uint8Array> {
  const datos = new TextEncoder().encode(valor);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", datos));
}

function igualesEnTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferencia === 0;
}

export async function cronAutorizado(peticion: Request): Promise<boolean> {
  const esperado = process.env.CRON_SECRET;

  // Sin secreto configurado la tarea NO queda abierta: queda cerrada. Un cron
  // que no corre se nota; uno que cualquiera puede disparar, no.
  if (!esperado || esperado.length < 16) {
    console.error("[cron] CRON_SECRET ausente o demasiado corto: se rechaza la peticion.");
    return false;
  }

  const encabezado = peticion.headers.get("authorization") ?? "";
  const recibido = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : encabezado;
  if (recibido === "") return false;

  const [a, b] = await Promise.all([digesto(esperado), digesto(recibido)]);
  return igualesEnTiempoConstante(a, b);
}

/** Respuesta uniforme: nunca dice si el secreto existe o si estaba mal. */
export function noAutorizado(): Response {
  return Response.json({ error: "No autorizado." }, { status: 401 });
}
