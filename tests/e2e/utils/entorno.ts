import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carga `.env` sin dependencias (Contexto.md §15.3: la contraseña no aparece en
 * `package.json` ni en el historial del shell).
 *
 * Los scripts de base usan `node --env-file`, pero Playwright arranca su propio
 * proceso y carga la configuracion antes de que eso aplique, asi que aqui se lee
 * el archivo a mano. Lo que ya exista en el entorno manda: en CI las variables
 * llegan por secretos y no debe pisarlas un `.env` local.
 */
export function cargarEnv(archivo = ".env"): void {
  let contenido: string;
  try {
    contenido = readFileSync(resolve(process.cwd(), archivo), "utf8");
  } catch {
    return; // En CI no hay .env: las variables vienen del entorno.
  }

  for (const linea of contenido.split("\n")) {
    const coincidencia = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    const clave = coincidencia?.[1];
    const crudo = coincidencia?.[2];
    if (!clave || crudo === undefined) continue;
    if (process.env[clave] !== undefined) continue;

    process.env[clave] = crudo.trim().replace(/^["']|["']$/g, "");
  }
}

export function requerida(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(
      `Falta ${nombre}. Los E2E necesitan el token y la base del entorno de desarrollo (§15.4).`,
    );
  }
  return valor;
}

/** Prefijo de todo lo que crean los E2E, para poder limpiarlo despues. */
export const PREFIJO_E2E = "[e2e]";
