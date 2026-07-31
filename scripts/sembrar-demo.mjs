/**
 * Limpia la información propia de la base y la repuebla con los 5 proyectos de
 * prueba de `supabase/demo.sql`.
 *
 *   npm run db:demo              # base sin datos propios
 *   npm run db:demo -- --force   # borrando lo que ya hubiera
 *
 * No toca el catálogo del sistema (tipos de proyecto, categorías, métodos de
 * pago, ajustes): eso lo siembra `db:seed` y está protegido por trigger. Si el
 * catálogo no está, este script se detiene antes de borrar nada, porque
 * `demo.sql` resuelve cada categoría por nombre y fallaría a mitad de camino.
 *
 * La guarda de `--force` es la misma de `reiniciar-base.mjs` (§15.2): un script
 * destructivo no borra información propia sin que se lo pidan dos veces.
 */
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Falta SUPABASE_DB_URL. Complétala en .env (Supabase → Project Settings → Database → URI).",
  );
  process.exit(1);
}

const forzar = process.argv.includes("--force");

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 5 });

try {
  // ─── El catálogo del sistema tiene que estar ───────────────────────────────
  const [catalogo] = await sql`
    select
      (select count(*)::int from tipos_proyecto where es_sistema) as tipos,
      (select count(*)::int from categorias     where es_sistema) as categorias,
      (select count(*)::int from metodos_pago)                    as metodos`;

  if (catalogo.tipos === 0 || catalogo.categorias === 0 || catalogo.metodos === 0) {
    console.error(
      "El catálogo del sistema está incompleto " +
        `(${catalogo.tipos} tipos, ${catalogo.categorias} categorías, ${catalogo.metodos} métodos de pago).\n` +
        "Ejecuta primero `npm run db:seed`.",
    );
    process.exit(1);
  }

  // ─── Guarda: no borrar información real sin querer ────────────────────────
  const [antes] = await sql`
    select
      (select count(*)::int from proyectos)    as proyectos,
      (select count(*)::int from movimientos)  as movimientos,
      (select count(*)::int from obligaciones) as obligaciones,
      (select count(*)::int from documentos)   as documentos`;

  const total = antes.proyectos + antes.movimientos + antes.obligaciones + antes.documentos;

  if (total > 0) {
    console.log("La base tiene información propia:");
    for (const [tabla, n] of Object.entries(antes)) if (n > 0) console.log(`   ${tabla}: ${n}`);

    if (!forzar) {
      console.error("\nEste script la borraría. Si es lo que quieres: npm run db:demo -- --force");
      process.exit(1);
    }
    console.log("\n⚠️  --force: se borra y se reemplaza por los datos de prueba.\n");
  }

  // Los soportes de Storage no se borran por SQL: el trigger
  // storage.protect_delete lo impide, y con razón — borrar la fila deja el
  // archivo huérfano en el almacenamiento. Mismo criterio que reiniciar-base.mjs.
  const [soportes] = await sql`
    select count(*)::int as n from storage.objects where bucket_id = 'soportes'`;
  if (soportes.n > 0) {
    console.log(
      `Bucket 'soportes': ${soportes.n} archivo(s) que este script NO borra ` +
        "(hazlo desde el panel de Storage si quieres empezar de cero).\n",
    );
  }

  // ─── Limpieza y alta ──────────────────────────────────────────────────────
  // Todo el archivo va en una sola sentencia simple, así que PostgreSQL lo
  // envuelve en una transacción implícita: o queda la demo completa, o no se
  // borra nada.
  await sql.unsafe(await readFile("supabase/demo.sql", "utf8"));

  // ─── Resumen ──────────────────────────────────────────────────────────────
  const proyectos = await sql`
    select p.nombre,
           t.nombre                            as tipo,
           p.estado,
           count(m.id)::int                    as movimientos,
           coalesce(r.total_invertido, 0)      as invertido,
           coalesce(r.total_ingresos, 0)       as ingresos,
           coalesce(r.balance, 0)              as balance,
           pat.patrimonio_neto
      from proyectos p
      join tipos_proyecto t         on t.id = p.tipo_proyecto_id
      left join movimientos m       on m.proyecto_id = p.id
      left join v_resumen_proyecto r on r.proyecto_id = p.id
      left join v_patrimonio_proyecto pat on pat.proyecto_id = p.id
     group by p.nombre, t.nombre, p.estado, r.total_invertido, r.total_ingresos,
              r.balance, pat.patrimonio_neto
     order by p.nombre`;

  const [totales] = await sql`
    select
      (select count(*)::int from movimientos)                          as movimientos,
      (select count(*)::int from movimientos where estado = 'pagado')  as pagados,
      (select count(*)::int from movimientos where estado <> 'pagado') as abiertos,
      (select count(*)::int from obligaciones)                         as obligaciones,
      (select count(*)::int from ocurrencias_obligacion)               as ocurrencias,
      (select count(*)::int from ocurrencias_obligacion where estado = 'vencida') as vencidas,
      (select count(*)::int from pasivos)                              as pasivos,
      (select count(*)::int from valoraciones)                         as valoraciones,
      (select count(*)::int from presupuestos)                         as presupuestos`;

  const pesos = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

  console.log(`\nDatos de prueba creados: ${proyectos.length} proyectos\n`);
  for (const p of proyectos) {
    console.log(`  ${p.nombre}  ·  ${p.tipo}  ·  ${p.estado}`);
    console.log(
      `     ${p.movimientos} movimientos  ·  invertido ${pesos.format(p.invertido)}  ·  ` +
        `ingresos ${pesos.format(p.ingresos)}  ·  balance ${pesos.format(p.balance)}` +
        (p.patrimonio_neto === null ? "" : `  ·  patrimonio ${pesos.format(p.patrimonio_neto)}`),
    );
  }

  console.log(
    `\n  ${totales.movimientos} movimientos (${totales.pagados} pagados, ${totales.abiertos} abiertos)\n` +
      `  ${totales.obligaciones} obligaciones → ${totales.ocurrencias} ocurrencias ` +
      `(${totales.vencidas} vencida${totales.vencidas === 1 ? "" : "s"})\n` +
      `  ${totales.pasivos} pasivos  ·  ${totales.valoraciones} valoraciones  ·  ` +
      `${totales.presupuestos} presupuestos\n`,
  );
} catch (error) {
  console.error("\nLos datos de prueba fallaron:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
