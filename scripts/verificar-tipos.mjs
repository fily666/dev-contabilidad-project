/**
 * Contrasta `src/shared/infrastructure/supabase/database.types.ts` con el
 * esquema real de la base remota.
 *
 * `supabase gen types` necesita Docker, descartado en este proyecto
 * (Contexto.md ADR-04). Mientras el archivo de tipos se mantenga a mano, este
 * script es la red de seguridad: detecta columnas faltantes, sobrantes o con
 * nulabilidad distinta a la de la base.
 *
 *   node scripts/verificar-tipos.mjs "$SUPABASE_DB_URL"
 *
 * Salida 0 si coincide todo; 1 si hay diferencias.
 */
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const RUTA_TIPOS = "src/shared/infrastructure/supabase/database.types.ts";

const url = process.argv[2] ?? process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Falta la cadena de conexión. Pásala como argumento o en SUPABASE_DB_URL.");
  process.exit(1);
}

/** Extrae, por entidad, el conjunto de columnas y su nulabilidad del archivo TS. */
function leerTipos(fuente) {
  const entidades = new Map();

  // Cada entidad es "nombre: {" seguido de un bloque "Row: { ... };"
  const patronEntidad = /^ {6}(\w+): \{$/gm;
  let coincidencia;
  while ((coincidencia = patronEntidad.exec(fuente)) !== null) {
    const nombre = coincidencia[1];
    const resto = fuente.slice(coincidencia.index);
    const inicioRow = resto.indexOf("Row: {");
    if (inicioRow === -1) continue;
    const finRow = resto.indexOf("};", inicioRow);
    if (finRow === -1) continue;

    const cuerpo = resto.slice(inicioRow + "Row: {".length, finRow);
    const columnas = new Map();
    for (const linea of cuerpo.split("\n")) {
      const m = /^\s*(\w+):\s*(.+?);\s*$/.exec(linea);
      if (!m) continue;
      columnas.set(m[1], /\bnull\b/.test(m[2]));
    }
    if (columnas.size > 0) entidades.set(nombre, columnas);
  }

  return entidades;
}

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 5 });

try {
  const fuente = await readFile(RUTA_TIPOS, "utf8");
  const declarados = leerTipos(fuente);

  const columnas = await sql`
    select c.table_name, c.column_name, c.is_nullable = 'YES' as nulable,
           t.table_type = 'VIEW' as es_vista
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and t.table_type in ('BASE TABLE', 'VIEW')
     order by c.table_name, c.ordinal_position`;

  const reales = new Map();
  const esVista = new Set();
  for (const fila of columnas) {
    if (!reales.has(fila.table_name)) reales.set(fila.table_name, new Map());
    reales.get(fila.table_name).set(fila.column_name, fila.nulable);
    if (fila.es_vista) esVista.add(fila.table_name);
  }

  let problemas = 0;

  for (const [entidad, columnasReales] of reales) {
    const columnasDeclaradas = declarados.get(entidad);
    if (!columnasDeclaradas) {
      console.log(`❌ ${entidad}: existe en la base pero no está declarada en los tipos`);
      problemas += 1;
      continue;
    }

    const faltantes = [...columnasReales.keys()].filter((c) => !columnasDeclaradas.has(c));
    const sobrantes = [...columnasDeclaradas.keys()].filter((c) => !columnasReales.has(c));

    // PostgreSQL reporta TODA columna de vista como nulable porque no puede
    // demostrar lo contrario a traves de una consulta. En las vistas de §6.4 los
    // agregados van envueltos en coalesce(), asi que declararlos no nulables es
    // correcto y mas util: la nulabilidad de vistas no se compara.
    const nulabilidad = esVista.has(entidad)
      ? []
      : [...columnasReales.entries()]
          .filter(
            ([c, nulable]) => columnasDeclaradas.has(c) && columnasDeclaradas.get(c) !== nulable,
          )
          .map(([c, nulable]) => `${c} (base: ${nulable ? "nulable" : "no nulable"})`);

    if (faltantes.length === 0 && sobrantes.length === 0 && nulabilidad.length === 0) {
      const etiqueta = esVista.has(entidad) ? "vista" : "tabla";
      console.log(`✅ ${entidad} (${etiqueta}, ${columnasReales.size} columnas)`);
      continue;
    }

    problemas += 1;
    console.log(`⚠️  ${entidad}`);
    if (faltantes.length) console.log(`      faltan en los tipos: ${faltantes.join(", ")}`);
    if (sobrantes.length) console.log(`      no existen en la base: ${sobrantes.join(", ")}`);
    if (nulabilidad.length) console.log(`      nulabilidad distinta: ${nulabilidad.join(", ")}`);
  }

  for (const entidad of declarados.keys()) {
    if (!reales.has(entidad)) {
      console.log(`❌ ${entidad}: declarada en los tipos pero no existe en la base`);
      problemas += 1;
    }
  }

  console.log(
    problemas === 0
      ? `\nLos tipos coinciden con el esquema real (${reales.size} entidades).`
      : `\n${problemas} entidad(es) con diferencias.`,
  );
  process.exitCode = problemas === 0 ? 0 : 1;
} finally {
  await sql.end();
}
