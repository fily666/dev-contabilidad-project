/**
 * Borra el esquema de la aplicación en la base remota para poder reaplicar las
 * migraciones desde cero.
 *
 * `supabase db reset` solo funciona contra la base local, que necesita Docker
 * (Contexto.md ADR-04). Este script cubre el caso remoto sin contenedores.
 *
 * SEGURIDAD: se niega a ejecutarse si hay datos propios (proyectos, movimientos,
 * obligaciones o documentos). Con `--force` los borra igualmente, y eso sí es
 * irreversible.
 *
 *   npm run db:reset      # este script y después db:seed
 *
 * No toca el esquema `public` completo a propósito: dropear el esquema en
 * Supabase obliga a reponer a mano los permisos que espera la plataforma. Se
 * eliminan solo los objetos que crean nuestras migraciones.
 */
import postgres from "postgres";
import { readdir } from "node:fs/promises";

const url = process.env.SUPABASE_DB_URL ?? process.argv[2];
if (!url) {
  console.error("Falta SUPABASE_DB_URL.");
  process.exit(1);
}

const forzar = process.argv.includes("--force");

const TABLAS = [
  "registro_auditoria",
  "notificaciones",
  "presupuestos",
  "valoraciones",
  "pasivos",
  "documentos",
  "ocurrencias_obligacion",
  "obligaciones",
  "movimientos",
  "metodos_pago",
  "categorias",
  "proyectos",
  "tipos_proyecto",
  "ajustes",
  "perfiles", // del esquema anterior, por si queda
];

const VISTAS = [
  "v_resumen_proyecto",
  "v_flujo_caja_mensual",
  "v_metricas_12m",
  "v_gastos_por_categoria",
  "v_agenda_obligaciones",
  "v_flujo_proyectado_mensual",
  "v_patrimonio_proyecto",
];

const FUNCIONES = [
  "actualizar_timestamp()",
  "registrar_auditoria()",
  "proteger_filas_de_sistema()",
  "validar_movimiento()",
  "meses_por_frecuencia(frecuencia, int)",
  "siguiente_vencimiento(date, int)",
  "generar_ocurrencias(int)",
  "marcar_vencidos()",
  "crear_perfil_al_registrarse()", // del esquema anterior
];

const TIPOS = [
  "estado_proyecto",
  "tipo_movimiento",
  "naturaleza_categoria",
  "estado_movimiento",
  "frecuencia",
  "estado_ocurrencia",
  "tipo_documento",
  "tipo_pasivo",
  "canal_notificacion",
  "estado_notificacion",
];

// onnotice vacío: los "does not exist, skipping" de cada DROP IF EXISTS son
// esperados y llenarían la salida de ruido.
const sql = postgres(url, {
  ssl: "require",
  prepare: false,
  max: 1,
  idle_timeout: 5,
  onnotice: () => {},
});

try {
  // ─── Guarda: no borrar información real sin querer ────────────────────────
  const existe = async (tabla) => {
    const [fila] = await sql`
      select count(*)::int as n from information_schema.tables
       where table_schema = 'public' and table_name = ${tabla}`;
    return fila.n > 0;
  };

  let datos = 0;
  for (const tabla of ["proyectos", "movimientos", "obligaciones", "documentos"]) {
    if (!(await existe(tabla))) continue;
    const [fila] = await sql`select count(*)::int as n from ${sql(tabla)}`;
    if (fila.n > 0) console.log(`   ${tabla}: ${fila.n} fila(s)`);
    datos += fila.n;
  }

  if (datos > 0 && !forzar) {
    console.error(
      `\nLa base tiene ${datos} fila(s) de información propia. Este script las borraría.\n` +
        "Si es lo que quieres, vuelve a ejecutarlo con --force.",
    );
    process.exit(1);
  }
  if (datos > 0) {
    console.log(`\n⚠️  --force: se eliminarán ${datos} fila(s) de información propia.\n`);
  }

  // ─── Borrado ──────────────────────────────────────────────────────────────
  // Los triggers y las políticas se van con las tablas; las vistas se listan
  // aparte porque `drop table cascade` las eliminaría sin dejar rastro del qué.
  for (const vista of VISTAS) await sql.unsafe(`drop view if exists ${vista} cascade`);
  console.log(`Vistas eliminadas: ${VISTAS.length}`);

  for (const tabla of TABLAS) await sql.unsafe(`drop table if exists ${tabla} cascade`);
  console.log(`Tablas eliminadas: ${TABLAS.length}`);

  for (const funcion of FUNCIONES) await sql.unsafe(`drop function if exists ${funcion} cascade`);
  console.log(`Funciones eliminadas: ${FUNCIONES.length}`);

  for (const tipo of TIPOS) await sql.unsafe(`drop type if exists ${tipo} cascade`);
  console.log(`Enumerados eliminados: ${TIPOS.length}`);

  // Storage no se toca por SQL. Supabase lo impide con el trigger
  // storage.protect_delete, y hace bien: borrar la fila de storage.objects no
  // borra el archivo, solo lo deja huérfano en el almacenamiento. Los soportes se
  // eliminan por la API de Storage o desde el panel.
  // El bucket tampoco hace falta borrarlo: la migración lo crea con
  // `on conflict (id) do update`, así que reaplicarla lo deja bien configurado.
  const [soportes] = await sql`
    select count(*)::int as n from storage.objects where bucket_id = 'soportes'`;
  console.log(
    soportes.n === 0
      ? "Bucket 'soportes': vacío, se conserva"
      : `Bucket 'soportes': ${soportes.n} archivo(s) que este script NO borra ` +
          "(hazlo desde el panel de Storage si quieres empezar de cero)",
  );

  // El trigger del esquema anterior vivía en auth.users, fuera de public.
  await sql`drop trigger if exists usuarios_crear_perfil on auth.users`;

  // ─── Historial de migraciones ─────────────────────────────────────────────
  // Se dejan solo las versiones que existen como archivo. Si no, `supabase db
  // push` se queja de migraciones aplicadas en remoto que ya no están en local.
  const versionesLocales = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.split("_")[0]);

  const [{ existe: hayHistorial }] = await sql`
    select count(*) > 0 as existe from information_schema.tables
     where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'`;

  if (hayHistorial) {
    const borradas = await sql`
      delete from supabase_migrations.schema_migrations
       where version <> all(${sql.array(versionesLocales)}::text[])`;
    const restantes = await sql`
      select version from supabase_migrations.schema_migrations order by version`;
    console.log(
      `Historial de migraciones: ${borradas.count} registro(s) obsoleto(s) eliminado(s), ` +
        `${restantes.length} vigente(s)`,
    );
  }

  // El hash del seed hay que borrarlo también, y es la trampa del proceso: la CLI
  // guarda en `seed_files` el hash de cada semilla aplicada, y si lo encuentra
  // igual NO la vuelve a ejecutar — informa "hash update" y sigue. El resultado es
  // un esquema recién creado y completamente vacío, sin ningún error a la vista.
  const [{ existe: hayHashes }] = await sql`
    select count(*) > 0 as existe from information_schema.tables
     where table_schema = 'supabase_migrations' and table_name = 'seed_files'`;

  if (hayHashes) {
    const borrados = await sql`delete from supabase_migrations.seed_files`;
    console.log(`Hash del seed: ${borrados.count} registro(s) eliminado(s), se volverá a ejecutar`);
  }

  console.log("\nEsquema limpio. Ejecuta `npm run db:seed` para reconstruirlo.\n");
} finally {
  await sql.end();
}
