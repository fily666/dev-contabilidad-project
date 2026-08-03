"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import { esquemaMarcarAvisoLeido, esquemaMarcarTodosLeidos } from "./schemas";

/**
 * La campana vive en el shell privado, así que su contador cuelga del layout y
 * no de una ruta: revalidar `/avisos` no bastaría para que la insignia bajara en
 * la pantalla donde se está. `revalidatePath("/", "layout")` invalida el layout
 * completo, que es exactamente el alcance del dato (§10.2).
 */
function revalidarBandeja() {
  revalidatePath("/", "layout");
  revalidatePath("/avisos");
}

/** RF-59: el dueño vio un aviso. */
export async function marcarAvisoLeidoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaMarcarAvisoLeido, datos, async (entrada) => {
    const { id } = await contenedor.notificaciones.marcarLeido.ejecutar(entrada);
    revalidarBandeja();
    return { id };
  });
}

/** RF-59: «marcar todo como leído». */
export async function marcarTodosLosAvisosLeidosAction(
  datos?: unknown,
): Promise<Resultado<{ leidos: number }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaMarcarTodosLeidos, datos ?? {}, async () => {
    const { leidos } = await contenedor.notificaciones.marcarTodosLeidos.ejecutar();
    revalidarBandeja();
    return { leidos };
  });
}
