import type { CredencialAcceso } from "../domain/sesion";

/**
 * ADAPTADOR de CredencialAcceso sobre variables de entorno (§9, §15.1).
 *
 * Se valida al leer, no al arrancar, porque el runtime Edge del middleware y el
 * de Node evaluan los modulos en momentos distintos. El mensaje es explicito a
 * proposito: un despliegue sin estas variables debe fallar de forma obvia y no
 * quedarse con una puerta abierta.
 */

export const LONGITUD_MINIMA_TOKEN = 8;
export const LONGITUD_MINIMA_SECRETO = 32;

function requerida(nombre: string, minimo: number): string {
  const valor = process.env[nombre]?.trim();

  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env y complétala antes de arrancar.`,
    );
  }
  if (valor.length < minimo) {
    throw new Error(`La variable ${nombre} debe tener al menos ${minimo} caracteres.`);
  }
  return valor;
}

export function credencialDelEntorno(): CredencialAcceso {
  return {
    token: () => requerida("TOKEN_ACCESO", LONGITUD_MINIMA_TOKEN),
    secretoSesion: () => requerida("SECRETO_SESION", LONGITUD_MINIMA_SECRETO),
  };
}
