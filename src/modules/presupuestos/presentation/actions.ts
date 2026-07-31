"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarPresupuesto,
  esquemaCopiarPresupuestos,
  esquemaCrearPresupuesto,
  esquemaEliminarPresupuesto,
} from "./schemas";

function revalidar(proyectoId?: string | null) {
  revalidatePath("/presupuestos");
  revalidatePath("/dashboard");
  if (proyectoId) revalidatePath(`/proyectos/${proyectoId}`);
}

/** RF-80. */
export async function crearPresupuestoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCrearPresupuesto, datos, async (entrada) => {
    const presupuesto = await contenedor.presupuestos.crear.ejecutar(entrada);
    revalidar(presupuesto.proyectoId);
    return { id: presupuesto.id };
  });
}

export async function actualizarPresupuestoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarPresupuesto, datos, async (entrada) => {
    const presupuesto = await contenedor.presupuestos.actualizar.ejecutar(entrada);
    revalidar(presupuesto.proyectoId);
    return { id: presupuesto.id };
  });
}

export async function eliminarPresupuestoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarPresupuesto, datos, async (entrada) => {
    await contenedor.presupuestos.eliminar.ejecutar(entrada);
    revalidar();
    return { id: entrada.id };
  });
}

/** RF-83: copiar al periodo siguiente; los que ya existan se omiten. */
export async function copiarPresupuestosAction(
  datos: unknown,
): Promise<Resultado<{ copiados: number; omitidos: number; destino: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCopiarPresupuestos, datos, async (entrada) => {
    const { copiados, omitidos, destino } = await contenedor.presupuestos.copiar.ejecutar(entrada);
    revalidar(entrada.proyectoId);
    return { copiados, omitidos, destino: `${destino.inicio} a ${destino.fin}` };
  });
}
