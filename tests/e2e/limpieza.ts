import postgres from "postgres";

import { PREFIJO_E2E, cargarEnv, requerida } from "./utils/entorno";

/**
 * Borra los proyectos que crearon los E2E y sus movimientos.
 *
 * Va por SQL y no por la interfaz porque RF-18 impide eliminar un proyecto con
 * movimientos, y anular no borra la fila: por diseno el sistema no ofrece un
 * camino de borrado total, y hace bien (ADR-12). Aqui interesa lo contrario, asi
 * que se usa `SUPABASE_DB_URL`, que es exactamente para lo que existe (§9.3).
 *
 * El filtro es el prefijo `[e2e]`: nunca toca un proyecto real.
 */
export default async function limpiar(): Promise<void> {
  cargarEnv();

  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) {
    console.warn("[e2e] sin SUPABASE_DB_URL: no se limpian los datos de prueba.");
    return;
  }

  const sql = postgres(requerida("SUPABASE_DB_URL"), { max: 1, prepare: false });

  try {
    const patron = `${PREFIJO_E2E}%`;

    const proyectos = await sql<{ id: string }[]>`
      select id from proyectos where nombre like ${patron}
    `;

    if (proyectos.length === 0) return;

    const ids = proyectos.map((p) => p.id);

    // El orden importa: movimientos referencia proyectos con `on delete restrict`.
    await sql`delete from movimientos where proyecto_id in ${sql(ids)}`;
    await sql`delete from proyectos where id in ${sql(ids)}`;

    console.log(`[e2e] limpiados ${ids.length} proyecto(s) de prueba.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
