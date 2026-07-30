"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import type { MetodoPagoVista } from "../domain/metodo-pago.repository";
import {
  esquemaActualizarMetodoPago,
  esquemaEliminarMetodoPago,
  esquemaMetodoPago,
} from "./schemas";

/**
 * Server Actions del catalogo de metodos de pago (RF-33).
 *
 * Cada una valida con el esquema del formulario y delega en un caso de uso: no
 * hay reglas de negocio aqui, viven en el dominio y en `application/` (§7.4).
 */

function revalidar() {
  revalidatePath("/configuracion");
  revalidatePath("/movimientos");
}

export async function crearMetodoPagoAction(datos: unknown): Promise<Resultado<MetodoPagoVista>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaMetodoPago, datos, async (entrada) => {
    const metodo = await contenedor.metodosPago.crear.ejecutar(entrada);
    revalidar();
    return metodo;
  });
}

export async function actualizarMetodoPagoAction(
  datos: unknown,
): Promise<Resultado<MetodoPagoVista>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarMetodoPago, datos, async (entrada) => {
    const metodo = await contenedor.metodosPago.actualizar.ejecutar(entrada);
    revalidar();
    return metodo;
  });
}

export async function eliminarMetodoPagoAction(datos: unknown): Promise<Resultado<null>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarMetodoPago, datos, async (entrada) => {
    await contenedor.metodosPago.eliminar.ejecutar({ id: entrada.id });
    revalidar();
    return null;
  });
}
