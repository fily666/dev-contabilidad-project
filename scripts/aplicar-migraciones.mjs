/**
 * Aplica las migraciones (y opcionalmente el seed) a la base indicada en
 * SUPABASE_DB_URL, sin exponer la contraseña en package.json ni en el historial
 * del shell.
 *
 *   npm run db:push          # solo migraciones
 *   npm run db:seed          # migraciones + seed
 */
import { spawnSync } from "node:child_process";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Falta SUPABASE_DB_URL. Complétala en .env (Supabase → Project Settings → Database → URI).",
  );
  process.exit(1);
}

const conSeed = process.argv.includes("--seed");
const argumentos = ["supabase", "db", "push", "--db-url", url, "--yes"];
if (conSeed) argumentos.push("--include-seed");

const resultado = spawnSync("npx", argumentos, { stdio: "inherit" });
process.exit(resultado.status ?? 1);
