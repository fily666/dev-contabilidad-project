/**
 * Lectura y validacion de las variables de entorno (Contexto.md §15.1).
 * Falla temprano y con un mensaje claro si falta configuracion.
 */

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim() === "") {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env y completa las credenciales de Supabase.`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return requerida("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * Clave service_role: OMITE RLS y es la unica con permisos sobre la base
 * (migracion 20260730120300). Solo servidor; nunca debe llegar al navegador.
 * Ya no existe una clave anonima en uso: sin usuarios de Supabase Auth no hay
 * sesion que representar, y dejar la API publica abierta seria un riesgo gratis.
 */
export function claveServicio(): string {
  return requerida("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function urlAplicacion(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function secretoCron(): string {
  return requerida("CRON_SECRET", process.env.CRON_SECRET);
}
