/**
 * Prueba de humo contra la base REMOTA: verifica que triggers, vistas y blindaje
 * funcionan en Supabase y no solo en PostgreSQL embebido (tests/db).
 *
 * Registra movimientos, comprueba las cifras de §5.1, las invariantes y que los
 * roles públicos no tengan acceso, y borra todo lo que creó.
 *
 * SEGURIDAD: se niega a ejecutarse si la base ya tiene proyectos o movimientos,
 * para no tocar datos reales.
 *
 *   npm run db:smoke
 */
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL ?? process.argv[2];
if (!url) {
  console.error("Falta SUPABASE_DB_URL.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 5 });

let proyecto;
let fallos = 0;

function comprobar(descripcion, condicion, detalle = "") {
  if (condicion) {
    console.log(`  ✅ ${descripcion}`);
  } else {
    console.log(`  ❌ ${descripcion}${detalle ? ` — ${detalle}` : ""}`);
    fallos += 1;
  }
}

async function rechaza(descripcion, patron, consulta) {
  try {
    await consulta();
    comprobar(descripcion, false, "no lanzó error");
  } catch (error) {
    comprobar(descripcion, patron.test(String(error.message)), String(error.message).slice(0, 90));
  }
}

try {
  // ─── Guarda: solo sobre una base sin información propia ───────────────────
  const [{ proyectos, movimientos }] = await sql`
    select (select count(*) from proyectos)::int as proyectos,
           (select count(*) from movimientos)::int as movimientos`;

  if (proyectos > 0 || movimientos > 0) {
    console.error(
      `La base ya tiene datos (${proyectos} proyectos, ${movimientos} movimientos). ` +
        "Este script solo corre sobre una base vacía para no tocar información real.",
    );
    process.exit(1);
  }

  console.log("\n1. Semillas del sistema (§6.8)");
  const [semillas] = await sql`
    select (select count(*) from tipos_proyecto where es_sistema)::int as tipos,
           (select count(*) from categorias where es_sistema)::int as categorias,
           (select count(*) from metodos_pago)::int as metodos,
           (select count(*) from ajustes)::int as ajustes`;
  comprobar("5 tipos de proyecto", semillas.tipos === 5, `encontrados: ${semillas.tipos}`);
  comprobar("83 categorías", semillas.categorias === 83, `encontradas: ${semillas.categorias}`);
  comprobar("4 métodos de pago", semillas.metodos === 4, `encontrados: ${semillas.metodos}`);
  comprobar("una sola fila de ajustes", semillas.ajustes === 1, `filas: ${semillas.ajustes}`);

  await rechaza("no admite una segunda fila de ajustes", /check constraint|duplicate key/i, () =>
    sql`insert into ajustes (id) values (false)`,
  );

  console.log("\n2. Registro de movimientos y cifras de §5.1");
  const [creado] = await sql`
    insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
    select id, 'Apartamento de prueba (humo)', '2026-01-01'
      from tipos_proyecto where codigo = 'inmueble'
    returning id`;
  proyecto = creado.id;

  const insertar = (nombreCategoria, tipo, naturaleza, valor, estado) => sql`
    insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza,
                             fecha, fecha_pago, valor, descripcion, estado)
    select ${proyecto}, c.id, ${tipo}::tipo_movimiento,
           ${naturaleza}::naturaleza_categoria, '2026-02-01',
           ${estado === "pagado" ? "2026-02-01" : null}::date, ${valor},
           ${nombreCategoria}, ${estado}::estado_movimiento
      from categorias c where c.nombre = ${nombreCategoria} limit 1`;

  await insertar("Cuota inicial", "egreso", "capex", 60000000, "pagado");
  await insertar("Administracion", "egreso", "opex", 500000, "pagado");
  await insertar("Canon de arrendamiento", "ingreso", "ingreso", 2000000, "pagado");
  await insertar("Impuesto predial", "egreso", "opex", 9999999, "pendiente");

  const [resumen] = await sql`
    select total_invertido, total_gastos_operativos, total_ingresos, balance
      from v_resumen_proyecto where proyecto_id = ${proyecto}`;

  comprobar(
    "total invertido = 60.000.000 (solo capex pagado)",
    Number(resumen.total_invertido) === 60000000,
    `obtenido: ${resumen.total_invertido}`,
  );
  comprobar(
    "gastos operativos = 500.000 (excluye el pendiente)",
    Number(resumen.total_gastos_operativos) === 500000,
    `obtenido: ${resumen.total_gastos_operativos}`,
  );
  comprobar("ingresos = 2.000.000", Number(resumen.total_ingresos) === 2000000);

  const [proyectado] = await sql`
    select egresos_estimados from v_flujo_proyectado_mensual
     where proyecto_id = ${proyecto} and mes = '2026-02-01'`;
  comprobar(
    "el pendiente sí aparece en el flujo proyectado",
    Number(proyectado?.egresos_estimados) === 9999999,
    `obtenido: ${proyectado?.egresos_estimados}`,
  );

  console.log("\n3. Invariantes rechazadas por la base (§5.7)");
  await rechaza("categoría de ingreso en un egreso", /CATEGORIA_INCOMPATIBLE/, () =>
    insertar("Canon de arrendamiento", "egreso", "opex", 100000, "pendiente"),
  );
  await rechaza("valor cero", /valor/i, () =>
    insertar("Administracion", "egreso", "opex", 0, "pendiente"),
  );
  await rechaza("moneda distinta a la del proyecto", /MONEDA_INCOMPATIBLE/, () => sql`
    insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, moneda, descripcion)
    select ${proyecto}, c.id, 'egreso', 'opex', '2026-02-01', 100000, 'USD', 'En dólares'
      from categorias c where c.nombre = 'Administracion' limit 1`);

  console.log("\n4. Protección del catálogo del sistema (RF-34)");
  await rechaza("no se modifica una categoría del sistema", /FILA_DE_SISTEMA_NO_MODIFICABLE/, () =>
    sql`update categorias set nombre = 'Alterada' where nombre = 'Combustible'`,
  );
  await rechaza("no se elimina una categoría del sistema", /FILA_DE_SISTEMA_NO_ELIMINABLE/, () =>
    sql`delete from categorias where nombre = 'Combustible'`,
  );

  console.log("\n5. Blindaje frente a los roles públicos (§9)");
  const expuestos = await sql`
    select grantee, table_name from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')`;
  comprobar(
    "anon y authenticated sin permisos sobre public",
    expuestos.length === 0,
    `${expuestos.length} concesión(es): ${expuestos
      .slice(0, 3)
      .map((f) => `${f.grantee}→${f.table_name}`)
      .join(", ")}`,
  );

  const [politicas] = await sql`select count(*)::int as n from pg_policies where schemaname = 'public'`;
  comprobar("sin políticas RLS (denegación por omisión)", politicas.n === 0, `hay ${politicas.n}`);

  const sinRls = await sql`
    select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;
  comprobar(
    "RLS activo en todas las tablas",
    sinRls.length === 0,
    `sin RLS: ${sinRls.map((f) => f.tablename).join(", ")}`,
  );

  const [bucket] = await sql`select public from storage.buckets where id = 'soportes'`;
  comprobar("el bucket de soportes es privado", bucket?.public === false);

  console.log("\n6. Auditoría (RNF-08)");
  const [{ n: auditoria }] = await sql`
    select count(*)::int as n from registro_auditoria where entidad = 'movimientos'`;
  comprobar("registra los cambios", auditoria > 0, `registros: ${auditoria}`);
} finally {
  // ─── Limpieza ─────────────────────────────────────────────────────────────
  if (proyecto) {
    await sql`delete from movimientos where proyecto_id = ${proyecto}`;
    await sql`delete from proyectos where id = ${proyecto}`;
    await sql`delete from registro_auditoria where entidad in ('proyectos', 'movimientos')`;
    const [{ n }] = await sql`select count(*)::int as n from proyectos`;
    console.log(`\nLimpieza: proyecto de prueba eliminado. Proyectos restantes: ${n}`);
  }
  await sql.end();
}

console.log(
  fallos === 0
    ? "\nLa base remota se comporta como esperan las pruebas locales.\n"
    : `\n${fallos} comprobación(es) fallaron.\n`,
);
process.exitCode = fallos === 0 ? 0 : 1;
