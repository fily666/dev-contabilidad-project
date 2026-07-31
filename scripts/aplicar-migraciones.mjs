/**
 * Aplica las migraciones (y opcionalmente el seed) a la base indicada en
 * SUPABASE_DB_URL, sin exponer la contraseña en package.json ni en el historial
 * del shell.
 *
 *   npm run db:push          # solo migraciones
 *   npm run db:seed          # migraciones + seed
 *
 * El seed NO se delega a `supabase db push --include-seed`. Se comprobó que,
 * cuando la CLI ya tiene registrado el hash de `seed.sql`, al cambiar el archivo
 * **actualiza el hash y no vuelve a ejecutarlo**: el push termina en verde y la
 * base se queda sin los datos nuevos, que es la peor forma de fallar. Como
 * `seed.sql` es idempotente por diseño (§6.8), aquí se aplica con `postgres.js`
 * —el mismo camino que usan los demás scripts de `scripts/` (§15.2)— y así
 * `db:seed` significa siempre lo mismo.
 */
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Falta SUPABASE_DB_URL. Complétala en .env (Supabase → Project Settings → Database → URI).",
  );
  process.exit(1);
}

const conSeed = process.argv.includes("--seed");

const resultado = spawnSync("npx", ["supabase", "db", "push", "--db-url", url, "--yes"], {
  stdio: "inherit",
});

if (resultado.status !== 0) process.exit(resultado.status ?? 1);
if (!conSeed) process.exit(0);

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 5 });

try {
  const seed = await readFile("supabase/seed.sql", "utf8");
  await sql.unsafe(seed);

  const [tipos] = await sql`select count(*)::int as n from tipos_proyecto where es_sistema`;
  const [categorias] = await sql`select count(*)::int as n from categorias where es_sistema`;
  const [metodos] = await sql`select count(*)::int as n from metodos_pago`;

  console.log(
    `\nSeed aplicado: ${tipos?.n ?? 0} tipos de proyecto, ${categorias?.n ?? 0} categorías y ${metodos?.n ?? 0} métodos de pago del sistema.`,
  );
} catch (error) {
  console.error("\nEl seed falló:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
