"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarObligacion,
  esquemaCambiarEstadoObligacion,
  esquemaCambiarEstadoOcurrencia,
  esquemaCrearObligacion,
  esquemaEliminarObligacion,
  esquemaPagarOcurrencia,
} from "./schemas";

function revalidar(proyectoId?: string) {
  revalidatePath("/obligaciones");
  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  if (proyectoId) {
    revalidatePath(`/proyectos/${proyectoId}`);
    revalidatePath(`/proyectos/${proyectoId}/obligaciones`);
  }
}

/** RF-50, RF-51, RF-52. */
export async function crearObligacionAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor, ajustes } = await contenedorPrivado();
  return ejecutarAccion(esquemaCrearObligacion, datos, async (entrada) => {
    const obligacion = await contenedor.obligaciones.crear.ejecutar(entrada);

    // La primera ocurrencia debe existir al salir del formulario, no mañana
    // cuando corra el cron: es idempotente, asi que llamarlo aqui no duplica
    // nada (§10.1).
    await contenedor.obligaciones.generarOcurrencias.ejecutar({
      horizonteMeses: ajustes.horizonteProyeccionMeses,
    });

    revalidar(obligacion.proyectoId);
    return { id: obligacion.id };
  });
}

/** RF-50. */
export async function actualizarObligacionAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor, ajustes } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarObligacion, datos, async (entrada) => {
    const obligacion = await contenedor.obligaciones.actualizar.ejecutar(entrada);
    await contenedor.obligaciones.generarOcurrencias.ejecutar({
      horizonteMeses: ajustes.horizonteProyeccionMeses,
    });
    revalidar(obligacion.proyectoId);
    return { id: obligacion.id };
  });
}

/** RF-57. */
export async function cambiarEstadoObligacionAction(
  datos: unknown,
): Promise<Resultado<{ id: string; activa: boolean }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCambiarEstadoObligacion, datos, async (entrada) => {
    const obligacion = await contenedor.obligaciones.cambiarEstado.ejecutar(entrada);
    revalidar(obligacion.proyectoId);
    return { id: obligacion.id, activa: obligacion.activa };
  });
}

export async function eliminarObligacionAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarObligacion, datos, async (entrada) => {
    await contenedor.obligaciones.eliminar.ejecutar(entrada);
    revalidar();
    return { id: entrada.id };
  });
}

/** RF-54: pagar la ocurrencia crea el movimiento asociado. */
export async function pagarOcurrenciaAction(
  datos: unknown,
): Promise<Resultado<{ movimientoId: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaPagarOcurrencia, datos, async (entrada) => {
    const { movimientoId } = await contenedor.obligaciones.pagarOcurrencia.ejecutar(entrada);
    revalidar();
    revalidatePath("/movimientos");
    revalidatePath("/proyectos");
    return { movimientoId };
  });
}

/** RF-56. */
export async function cambiarEstadoOcurrenciaAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCambiarEstadoOcurrencia, datos, async (entrada) => {
    const ocurrencia = await contenedor.obligaciones.cambiarEstadoOcurrencia.ejecutar(entrada);
    revalidar();
    return { id: ocurrencia.id };
  });
}
