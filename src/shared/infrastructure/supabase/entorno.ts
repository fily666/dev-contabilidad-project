/**
 * Lectura y validacion de las variables de entorno (Contexto.md §15.1).
 * Falla temprano y con un mensaje claro si falta configuracion.
 */

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim() === "") {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env.local y completa las credenciales de Supabase.`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return requerida("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function claveAnonima(): string {
  return requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Solo servidor y solo para /api/cron (§9). */
export function claveServicio(): string {
  return requerida("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function urlAplicacion(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function secretoCron(): string {
  return requerida("CRON_SECRET", process.env.CRON_SECRET);
}
