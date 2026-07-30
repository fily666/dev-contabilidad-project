"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { contenedorDeAcceso, contenedorPrivado } from "@/di/container";
import type { Resultado } from "@/shared/domain/resultado";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";

import type { Ajustes } from "../domain/sesion";
import { esquemaAcceso, esquemaAjustes } from "./schemas";

/**
 * Identifica al solicitante para el freno de fuerza bruta. Detras de Vercel la
 * IP real llega en x-forwarded-for; si no hay ninguna, todos los intentos caen
 * en el mismo cubo, que es el lado seguro del error.
 */
async function origenDelIntento(): Promise<string> {
  const cabeceras = await headers();
  const reenviada = cabeceras.get("x-forwarded-for");
  return reenviada?.split(",")[0]?.trim() || cabeceras.get("x-real-ip") || "desconocido";
}

/** RF-01: entrar con el token de acceso. */
export async function ingresarAction(datos: unknown): Promise<Resultado<null>> {
  const acceso = await contenedorDeAcceso();
  const origen = await origenDelIntento();

  return ejecutarAccion(esquemaAcceso, datos, async (entrada) => {
    await acceso.iniciar.ejecutar(entrada.token, origen);
    revalidatePath("/", "layout");
    return null;
  });
}

/** RF-04: salir. */
export async function salirAction(): Promise<void> {
  const acceso = await contenedorDeAcceso();
  await acceso.cerrar.ejecutar();
  revalidatePath("/", "layout");
  redirect("/acceso");
}

/** RF-03: ajustes de la instalacion. */
export async function actualizarAjustesAction(datos: unknown): Promise<Resultado<Ajustes>> {
  const { contenedor } = await contenedorPrivado();

  return ejecutarAccion(esquemaAjustes, datos, async (entrada) => {
    const ajustes = await contenedor.ajustes.actualizar.ejecutar(entrada);
    revalidatePath("/configuracion");
    revalidatePath("/", "layout");
    return ajustes;
  });
}
