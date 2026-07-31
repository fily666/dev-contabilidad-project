"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaAbonarACapital,
  esquemaActualizarPasivo,
  esquemaCambiarEstadoPasivo,
  esquemaCrearPasivo,
  esquemaEliminarPasivo,
  esquemaEliminarValoracion,
  esquemaRegistrarValoracion,
} from "./schemas";

function revalidar(proyectoId?: string) {
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
  if (proyectoId) revalidatePath(`/proyectos/${proyectoId}`);
}

/** RF-17. */
export async function crearPasivoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCrearPasivo, datos, async (entrada) => {
    const pasivo = await contenedor.patrimonio.registrarPasivo.ejecutar(entrada);
    revalidar(pasivo.proyectoId);
    return { id: pasivo.id };
  });
}

export async function actualizarPasivoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarPasivo, datos, async (entrada) => {
    const pasivo = await contenedor.patrimonio.actualizarPasivo.ejecutar(entrada);
    revalidar(pasivo.proyectoId);
    return { id: pasivo.id };
  });
}

/** Abono a capital: baja el saldo sin tocar el monto original. */
export async function abonarACapitalAction(
  datos: unknown,
): Promise<Resultado<{ id: string; saldoActual: number }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaAbonarACapital, datos, async (entrada) => {
    const pasivo = await contenedor.patrimonio.abonarACapital.ejecutar(entrada);
    revalidar(pasivo.proyectoId);
    return { id: pasivo.id, saldoActual: pasivo.saldoActual };
  });
}

export async function cambiarEstadoPasivoAction(
  datos: unknown,
): Promise<Resultado<{ id: string; activo: boolean }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCambiarEstadoPasivo, datos, async (entrada) => {
    const pasivo = await contenedor.patrimonio.cambiarEstadoPasivo.ejecutar(entrada);
    revalidar(pasivo.proyectoId);
    return { id: pasivo.id, activo: pasivo.activo };
  });
}

export async function eliminarPasivoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarPasivo, datos, async (entrada) => {
    await contenedor.patrimonio.eliminarPasivo.ejecutar(entrada);
    revalidar();
    return { id: entrada.id };
  });
}

/** RF-16: de aquí sale la plusvalía y el patrimonio neto (§5.3). */
export async function registrarValoracionAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaRegistrarValoracion, datos, async (entrada) => {
    const valoracion = await contenedor.patrimonio.registrarValoracion.ejecutar(entrada);
    revalidar(valoracion.proyectoId);
    return { id: valoracion.id };
  });
}

export async function eliminarValoracionAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarValoracion, datos, async (entrada) => {
    await contenedor.patrimonio.eliminarValoracion.ejecutar(entrada);
    revalidar();
    return { id: entrada.id };
  });
}
