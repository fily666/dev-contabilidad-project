/**
 * Inspecciona el estado del esquema `public` en la base remota.
 *
 * `supabase db dump` y `supabase db diff` requieren Docker, que este proyecto
 * descarta (Contexto.md ADR-04). Este script cubre esa necesidad sin
 * contenedores: se conecta con postgres.js y reporta tablas, vistas, funciones,
 * triggers, RLS y conteos de las semillas.
 *
 *   node scripts/inspeccionar-base.mjs "$SUPABASE_DB_URL"
 */
import postgres from "postgres";

const url = process.argv[2] ?? process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Falta la cadena de conexión. Pásala como argumento o en SUPABASE_DB_URL.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 5 });

function tabla(titulo, filas) {
  console.log(`\n── ${titulo} ${"─".repeat(Math.max(0, 60 - titulo.length))}`);
  if (filas.length === 0) {
    console.log("   (vacío)");
    return;
  }
  for (const fila of filas) console.log("  ", Object.values(fila).join("  ·  "));
}

try {
  const tablas = await sql`
    select c.relname as tabla,
           case when c.relrowsecurity then 'RLS on' else 'RLS OFF' end as rls,
           (select count(*) from pg_policies p
             where p.schemaname = 'public' and p.tablename = c.relname)::int || ' políticas' as politicas
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname`;
  tabla(`Tablas (${tablas.length})`, tablas);

  const vistas = await sql`
    select table_name as vista from information_schema.views
     where table_schema = 'public' order by table_name`;
  tabla(`Vistas (${vistas.length})`, vistas);

  const funciones = await sql`
    select p.proname as funcion from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' order by p.proname`;
  tabla(`Funciones (${funciones.length})`, funciones);

  const triggers = await sql`
    select tgname as trigger, c.relname as tabla
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where not t.tgisinternal and (n.nspname = 'public' or c.relname = 'users')
     order by c.relname, tgname`;
  tabla(`Triggers (${triggers.length})`, triggers);

  const enums = await sql`
    select t.typname as enumeracion, count(e.enumlabel)::int || ' valores' as valores
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname order by t.typname`;
  tabla(`Enumerados (${enums.length})`, enums);

  const buckets = await sql`
    select id, case when public then 'público' else 'privado' end as visibilidad,
           file_size_limit || ' bytes' as limite
      from storage.buckets order by id`;
  tabla(`Buckets de Storage (${buckets.length})`, buckets);

  const existeTipos = tablas.some((t) => t.tabla === "tipos_proyecto");
  if (existeTipos) {
    const semillas = await sql`
      select 'tipos_proyecto del sistema' as concepto, count(*)::int as total
        from tipos_proyecto where es_sistema
      union all
      select 'categorías del sistema', count(*)::int from categorias where es_sistema
      union all
      select 'métodos de pago', count(*)::int from metodos_pago
      union all
      select 'ajustes (debe ser 1)', count(*)::int from ajustes
      union all
      select 'proyectos', count(*)::int from proyectos
      union all
      select 'movimientos', count(*)::int from movimientos`;
    tabla("Datos", semillas);
  }

  // ─── Blindaje: lo que de verdad hay que vigilar tras cada migracion ────────
  // Si aparece cualquier permiso aqui, la base quedo expuesta a quien tenga la
  // clave publicable del proyecto (Contexto.md §9, migracion 20260730120300).
  const expuestos = await sql`
    select grantee as rol, table_name as objeto, string_agg(privilege_type, ', ') as permisos
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')
     group by grantee, table_name
     order by grantee, table_name`;

  console.log(`\n── Blindaje ${"─".repeat(50)}`);
  if (expuestos.length === 0) {
    console.log("   ✅ anon y authenticated no tienen permisos sobre el esquema public");
  } else {
    console.log(`   ⚠️  ${expuestos.length} objeto(s) con permisos para roles públicos:`);
    for (const fila of expuestos) console.log("  ", Object.values(fila).join("  ·  "));
    process.exitCode = 1;
  }

  const politicas = await sql`select count(*)::int as n from pg_policies where schemaname = 'public'`;
  console.log(
    politicas[0].n === 0
      ? "   ✅ sin políticas RLS: denegación por omisión para todo rol sin BYPASSRLS"
      : `   ℹ️  ${politicas[0].n} política(s) RLS definidas`,
  );

  console.log();
} finally {
  await sql.end();
}
