import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseDePrueba, type BaseDePrueba } from "./harness";

/**
 * Pruebas de integracion del esquema (Contexto.md §8.8): ejecutan las
 * migraciones y el seed reales contra PostgreSQL embebido y verifican
 * invariantes, formulas y aislamiento por RLS.
 */
describe("esquema de base de datos", () => {
  let base: BaseDePrueba;
  let usuarioA: string;
  let usuarioB: string;

  beforeAll(async () => {
    base = await crearBaseDePrueba();
    usuarioA = await base.crearUsuario("ana@ejemplo.com", "Ana Gomez");
    usuarioB = await base.crearUsuario("beto@ejemplo.com", "Beto Ruiz");
  }, 120_000);

  afterAll(async () => {
    await base?.cerrar();
  });

  describe("alta de usuario (§6.6)", () => {
    it("crea el perfil automaticamente", async () => {
      const r = await base.db.query<{
        nombre_completo: string;
        moneda: string;
        zona_horaria: string;
      }>(`select nombre_completo, moneda, zona_horaria from perfiles where id = $1`, [usuarioA]);
      expect(r.rows[0]).toEqual({
        nombre_completo: "Ana Gomez",
        moneda: "COP",
        zona_horaria: "America/Bogota",
      });
    });

    it("siembra los metodos de pago por defecto (RF-33)", async () => {
      const r = await base.db.query<{ total: number }>(
        `select count(*)::int as total from metodos_pago where propietario_id = $1`,
        [usuarioA],
      );
      expect(r.rows[0]!.total).toBe(4);
    });
  });

  describe("seed del catalogo (§6.8)", () => {
    it("crea los cinco tipos de proyecto del sistema", async () => {
      const r = await base.db.query<{ codigo: string }>(
        `select codigo from tipos_proyecto where propietario_id is null order by codigo`,
      );
      expect(r.rows.map((f) => f.codigo)).toEqual([
        "inmueble",
        "inversion",
        "negocio",
        "otro",
        "vehiculo",
      ]);
    });

    it("declara los atributos dinamicos del vehiculo (§13)", async () => {
      const r = await base.db.query<{ claves: string[]; genera: boolean }>(
        `select array(select jsonb_array_elements(configuracion -> 'atributos') ->> 'clave') as claves,
                (configuracion ->> 'genera_ingresos')::boolean as genera
           from tipos_proyecto where propietario_id is null and codigo = 'vehiculo'`,
      );
      expect(r.rows[0]!.claves).toContain("placa");
      expect(r.rows[0]!.claves).toContain("cilindraje");
      expect(r.rows[0]!.genera).toBe(false);
    });

    it("cubre los conceptos de los escenarios de referencia (§3)", async () => {
      const esperados = [
        "Separacion",
        "Cuota inicial",
        "Gastos notariales",
        "Escrituracion",
        "Remodelacion",
        "Muebles",
        "Administracion",
        "Impuesto predial",
        "Servicios publicos",
        "Cuotas extraordinarias",
        "Canon de arrendamiento",
        "Valor de compra",
        "Matricula",
        "Accesorios",
        "Mantenimiento preventivo",
        "Reparaciones",
        "Combustible",
        "SOAT",
        "Revision tecnicomecanica",
        "Impuesto vehicular",
        "Cambio de aceite",
        "Cambio de llantas",
        "Renovacion de documentos",
        "Cuota de credito",
      ];
      const r = await base.db.query<{ nombre: string }>(
        `select distinct nombre from categorias where propietario_id is null`,
      );
      const existentes = new Set(r.rows.map((f) => f.nombre));
      expect(esperados.filter((c) => !existentes.has(c))).toEqual([]);
    });

    it("es idempotente: reejecutarlo no duplica categorias", async () => {
      const antes = await base.db.query<{ n: number }>(
        `select count(*)::int as n from categorias where propietario_id is null`,
      );
      const { readFile } = await import("node:fs/promises");
      const seed = await readFile("supabase/seed.sql", "utf8");
      await base.db.exec(seed);
      const despues = await base.db.query<{ n: number }>(
        `select count(*)::int as n from categorias where propietario_id is null`,
      );
      expect(despues.rows[0]!.n).toBe(antes.rows[0]!.n);
    });
  });

  describe("invariantes del dominio en base de datos (§5.7)", () => {
    let proyecto: string;
    let categoriaCanon: string;
    let categoriaPredial: string;

    beforeAll(async () => {
      const p = await base.db.query<{ id: string }>(
        `insert into proyectos (propietario_id, tipo_proyecto_id, nombre, fecha_inicio, creado_por)
         select $1, id, 'Apartamento 401', '2026-01-15', $1
           from tipos_proyecto where propietario_id is null and codigo = 'inmueble'
         returning id`,
        [usuarioA],
      );
      proyecto = p.rows[0]!.id;

      const c1 = await base.db.query<{ id: string }>(
        `select id from categorias where propietario_id is null and nombre = 'Canon de arrendamiento'`,
      );
      categoriaCanon = c1.rows[0]!.id;
      const c2 = await base.db.query<{ id: string }>(
        `select id from categorias where propietario_id is null and nombre = 'Impuesto predial'`,
      );
      categoriaPredial = c2.rows[0]!.id;
    });

    it("rechaza valores no positivos (§5.7.2)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, creado_por)
           values ($1, $2, $3, 'egreso', 'opex', '2026-02-01', 0, 'Predial', $1)`,
          [usuarioA, proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/valor/i);
    });

    it("rechaza una categoria de ingreso en un egreso (§5.7.3)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, creado_por)
           values ($1, $2, $3, 'egreso', 'opex', '2026-02-01', 100000, 'Canon como egreso', $1)`,
          [usuarioA, proyecto, categoriaCanon],
        ),
      ).rejects.toThrow(/CATEGORIA_INCOMPATIBLE/);
    });

    it("exige fecha de pago cuando el estado es pagado (§5.7.4)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, estado, creado_por)
           values ($1, $2, $3, 'egreso', 'opex', '2026-02-01', 100000, 'Predial', 'pagado', $1)`,
          [usuarioA, proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/pagado_requiere_fecha/);
    });

    it("exige motivo al anular (RF-22)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, estado, creado_por)
           values ($1, $2, $3, 'egreso', 'opex', '2026-02-01', 100000, 'Predial', 'anulado', $1)`,
          [usuarioA, proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/anulado_requiere_motivo/);
    });

    it("rechaza moneda distinta a la del proyecto (§5.7.5)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, moneda, descripcion, creado_por)
           values ($1, $2, $3, 'egreso', 'opex', '2026-02-01', 100000, 'USD', 'Predial', $1)`,
          [usuarioA, proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/MONEDA_INCOMPATIBLE/);
    });

    it("rechaza movimientos en un proyecto finalizado (§5.7.7)", async () => {
      const cerrado = await base.db.query<{ id: string }>(
        `insert into proyectos (propietario_id, tipo_proyecto_id, nombre, fecha_inicio, estado, creado_por)
         select $1, id, 'Proyecto cerrado', '2025-01-01', 'finalizado', $1
           from tipos_proyecto where propietario_id is null and codigo = 'otro'
         returning id`,
        [usuarioA],
      );
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, creado_por)
           values ($1, $2, $3, 'egreso', 'opex', '2026-02-01', 100000, 'Gasto', $1)`,
          [usuarioA, cerrado.rows[0]!.id, categoriaPredial],
        ),
      ).rejects.toThrow(/PROYECTO_CERRADO/);
    });

    it("valida el desglose de cuota de credito (RF-29)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, abono_capital, abono_interes, descripcion, creado_por)
           select $1, $2, id, 'egreso', 'financiacion', '2026-02-01', 1000000, 400000, 400000, 'Cuota', $1
             from categorias where propietario_id is null and nombre = 'Cuota de credito'`,
          [usuarioA, proyecto],
        ),
      ).rejects.toThrow(/desglose_credito/);
    });
  });

  describe("agregados y formulas (§5.1, §6.4)", () => {
    let proyecto: string;

    beforeAll(async () => {
      const p = await base.db.query<{ id: string }>(
        `insert into proyectos (propietario_id, tipo_proyecto_id, nombre, fecha_inicio, creado_por)
         select $1, id, 'Apartamento con cifras', '2026-01-01', $1
           from tipos_proyecto where propietario_id is null and codigo = 'inmueble'
         returning id`,
        [usuarioA],
      );
      proyecto = p.rows[0]!.id;

      // capex pagado 60.000.000 | opex pagado 500.000 | ingreso pagado 2.000.000
      // + un opex PENDIENTE de 9.999.999 que NO debe entrar en las cifras de caja
      await base.db.exec(`
        insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado, creado_por)
        select '${usuarioA}', '${proyecto}', c.id, 'egreso', 'capex', '2026-01-10', '2026-01-10', 60000000, 'Cuota inicial', 'pagado', '${usuarioA}'
          from categorias c where c.propietario_id is null and c.nombre = 'Cuota inicial';

        insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado, creado_por)
        select '${usuarioA}', '${proyecto}', c.id, 'egreso', 'opex', '2026-02-05', '2026-02-05', 500000, 'Administracion febrero', 'pagado', '${usuarioA}'
          from categorias c where c.propietario_id is null and c.nombre = 'Administracion';

        insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado, creado_por)
        select '${usuarioA}', '${proyecto}', c.id, 'ingreso', 'ingreso', '2026-02-05', '2026-02-05', 2000000, 'Canon febrero', 'pagado', '${usuarioA}'
          from categorias c where c.propietario_id is null and c.nombre = 'Canon de arrendamiento';

        insert into movimientos (propietario_id, proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_vencimiento, valor, descripcion, estado, creado_por)
        select '${usuarioA}', '${proyecto}', c.id, 'egreso', 'opex', '2026-03-01', '2026-03-10', 9999999, 'Predial pendiente', 'pendiente', '${usuarioA}'
          from categorias c where c.propietario_id is null and c.nombre = 'Impuesto predial';
      `);
    });

    it("separa inversion de gasto operativo", async () => {
      const r = await base.db.query<{
        total_invertido: string;
        total_gastos_operativos: string;
        total_ingresos: string;
        balance: string;
      }>(
        `select total_invertido, total_gastos_operativos, total_ingresos, balance
           from v_resumen_proyecto where proyecto_id = $1`,
        [proyecto],
      );
      expect(Number(r.rows[0]!.total_invertido)).toBe(60_000_000);
      expect(Number(r.rows[0]!.total_gastos_operativos)).toBe(500_000);
      expect(Number(r.rows[0]!.total_ingresos)).toBe(2_000_000);
      expect(Number(r.rows[0]!.balance)).toBe(2_000_000 - 60_500_000);
    });

    it("excluye los movimientos pendientes de la caja ejecutada (regla de oro §2)", async () => {
      const r = await base.db.query<{ total_gastos_operativos: string }>(
        `select total_gastos_operativos from v_resumen_proyecto where proyecto_id = $1`,
        [proyecto],
      );
      expect(Number(r.rows[0]!.total_gastos_operativos)).toBe(500_000);
    });

    it("incluye los pendientes en el flujo proyectado (§5.2)", async () => {
      const r = await base.db.query<{ egresos_estimados: string }>(
        `select egresos_estimados from v_flujo_proyectado_mensual
          where proyecto_id = $1 and mes = '2026-03-01'`,
        [proyecto],
      );
      expect(Number(r.rows[0]!.egresos_estimados)).toBe(9_999_999);
    });

    it("calcula el flujo de caja mensual", async () => {
      const r = await base.db.query<{ mes: string; flujo_neto: string }>(
        `select mes::text, flujo_neto from v_flujo_caja_mensual
          where proyecto_id = $1 order by mes`,
        [proyecto],
      );
      expect(r.rows).toHaveLength(2);
      expect(Number(r.rows[0]!.flujo_neto)).toBe(-60_000_000);
      expect(Number(r.rows[1]!.flujo_neto)).toBe(1_500_000);
    });

    it("una anulacion descuenta el valor de las cifras (RF-22)", async () => {
      await base.db.exec(`
        update movimientos
           set estado = 'anulado', motivo_anulacion = 'Registrado por error'
         where proyecto_id = '${proyecto}' and naturaleza = 'capex';
      `);
      const r = await base.db.query<{ total_invertido: string }>(
        `select total_invertido from v_resumen_proyecto where proyecto_id = $1`,
        [proyecto],
      );
      expect(Number(r.rows[0]!.total_invertido)).toBe(0);

      await base.db.exec(`
        update movimientos set estado = 'pagado', motivo_anulacion = null
         where proyecto_id = '${proyecto}' and naturaleza = 'capex';
      `);
    });

    it("registra la auditoria de cada cambio (RNF-08)", async () => {
      const r = await base.db.query<{ accion: string }>(
        `select accion from registro_auditoria
          where entidad = 'movimientos' and accion = 'anular' limit 1`,
      );
      expect(r.rows).toHaveLength(1);
    });
  });

  describe("recurrencias (§5.6)", () => {
    it("cae en el ultimo dia del mes cuando el dia no existe", async () => {
      const r = await base.db.query<{ f: string }>(
        `select siguiente_vencimiento('2026-01-31'::date, 1)::text as f`,
      );
      expect(r.rows[0]!.f).toBe("2026-02-28");
    });

    it("respeta el dia cuando si existe", async () => {
      const r = await base.db.query<{ f: string }>(
        `select siguiente_vencimiento('2026-03-15'::date, 3)::text as f`,
      );
      expect(r.rows[0]!.f).toBe("2026-06-15");
    });

    it("mapea la frecuencia a meses", async () => {
      const r = await base.db.query<{
        mensual: number;
        anual: number;
        unica: number;
        custom: number;
      }>(
        `select meses_por_frecuencia('mensual', null) as mensual,
                meses_por_frecuencia('anual', null)   as anual,
                meses_por_frecuencia('unica', null)   as unica,
                meses_por_frecuencia('personalizada', 4) as custom`,
      );
      expect(r.rows[0]).toEqual({ mensual: 1, anual: 12, unica: 0, custom: 4 });
    });

    it("genera ocurrencias y es idempotente (§10.1)", async () => {
      const proyecto = await base.db.query<{ id: string }>(
        `insert into proyectos (propietario_id, tipo_proyecto_id, nombre, fecha_inicio, creado_por)
         select $1, id, 'Moto XR', '2026-06-01', $1
           from tipos_proyecto where propietario_id is null and codigo = 'vehiculo'
         returning id`,
        [usuarioB],
      );

      await base.db.query(
        `insert into obligaciones (propietario_id, proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento, frecuencia, creado_por)
         select $1, $2, c.id, 'SOAT', 550000, (current_date + 30), 'anual', $1
           from categorias c where c.propietario_id is null and c.nombre = 'SOAT'`,
        [usuarioB, proyecto.rows[0]!.id],
      );
      await base.db.query(
        `insert into obligaciones (propietario_id, proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento, frecuencia, creado_por)
         select $1, $2, c.id, 'Cambio de aceite', 120000, (current_date + 15), 'trimestral', $1
           from categorias c where c.propietario_id is null and c.nombre = 'Cambio de aceite'`,
        [usuarioB, proyecto.rows[0]!.id],
      );

      const primera = await base.db.query<{ n: number }>(`select generar_ocurrencias(12) as n`);
      expect(primera.rows[0]!.n).toBeGreaterThan(0);

      const segunda = await base.db.query<{ n: number }>(`select generar_ocurrencias(12) as n`);
      expect(segunda.rows[0]!.n).toBe(0);

      const anual = await base.db.query<{ n: number }>(
        `select count(*)::int as n from ocurrencias_obligacion oc
           join obligaciones o on o.id = oc.obligacion_id
          where o.concepto = 'SOAT'`,
      );
      expect(anual.rows[0]!.n).toBe(1);

      const trimestral = await base.db.query<{ n: number }>(
        `select count(*)::int as n from ocurrencias_obligacion oc
           join obligaciones o on o.id = oc.obligacion_id
          where o.concepto = 'Cambio de aceite'`,
      );
      expect(trimestral.rows[0]!.n).toBe(4);
    });

    it("marca vencidos los pendientes con fecha pasada (§10.1)", async () => {
      const proyecto = await base.db.query<{ id: string }>(
        `select id from proyectos where propietario_id = $1 limit 1`,
        [usuarioB],
      );
      await base.db.query(
        `insert into obligaciones (propietario_id, proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento, frecuencia, creado_por)
         select $1, $2, c.id, 'Impuesto vencido', 90000, (current_date - 40), 'unica', $1
           from categorias c where c.propietario_id is null and c.nombre = 'Impuesto vehicular'`,
        [usuarioB, proyecto.rows[0]!.id],
      );
      await base.db.query(`select generar_ocurrencias(12)`);
      const r = await base.db.query<{ n: number }>(`select marcar_vencidos() as n`);
      expect(r.rows[0]!.n).toBeGreaterThan(0);

      const vencidas = await base.db.query<{ n: number }>(
        `select count(*)::int as n from ocurrencias_obligacion where estado = 'vencida'`,
      );
      expect(vencidas.rows[0]!.n).toBeGreaterThan(0);
    });
  });

  describe("aislamiento por RLS (RNF-11, §6.5)", () => {
    it("cada usuario solo ve sus proyectos", async () => {
      const deA = await base.comoUsuario(usuarioA, () =>
        base.db.query<{ n: number }>(`select count(*)::int as n from proyectos`),
      );
      const deB = await base.comoUsuario(usuarioB, () =>
        base.db.query<{ n: number }>(`select count(*)::int as n from proyectos`),
      );
      const total = await base.db.query<{ n: number }>(`select count(*)::int as n from proyectos`);

      expect(deA.rows[0]!.n).toBeGreaterThan(0);
      expect(deB.rows[0]!.n).toBeGreaterThan(0);
      expect(deA.rows[0]!.n + deB.rows[0]!.n).toBe(total.rows[0]!.n);
    });

    it("el usuario B no puede leer movimientos del usuario A", async () => {
      const r = await base.comoUsuario(usuarioB, () =>
        base.db.query<{ n: number }>(
          `select count(*)::int as n from movimientos where propietario_id = $1`,
          [usuarioA],
        ),
      );
      expect(r.rows[0]!.n).toBe(0);
    });

    it("el usuario B no puede modificar proyectos del usuario A", async () => {
      const afectados = await base.comoUsuario(usuarioB, () =>
        base.db.query(`update proyectos set nombre = 'Secuestrado' where propietario_id = $1`, [
          usuarioA,
        ]),
      );
      expect(afectados.affectedRows).toBe(0);
    });

    it("el usuario B no puede insertar registros a nombre del usuario A", async () => {
      await expect(
        base.comoUsuario(usuarioB, () =>
          base.db.query(
            `insert into proyectos (propietario_id, tipo_proyecto_id, nombre, fecha_inicio, creado_por)
             select $1, id, 'Inyectado', '2026-01-01', $1
               from tipos_proyecto where propietario_id is null and codigo = 'otro'`,
            [usuarioA],
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("el usuario B no puede eliminar documentos del usuario A", async () => {
      const afectados = await base.comoUsuario(usuarioB, () =>
        base.db.query(`delete from documentos where propietario_id = $1`, [usuarioA]),
      );
      expect(afectados.affectedRows).toBe(0);
    });

    it("las vistas heredan RLS por security_invoker (§6.4)", async () => {
      const r = await base.comoUsuario(usuarioB, () =>
        base.db.query<{ n: number }>(
          `select count(*)::int as n from v_resumen_proyecto where propietario_id = $1`,
          [usuarioA],
        ),
      );
      expect(r.rows[0]!.n).toBe(0);
    });

    it("los catalogos del sistema son legibles por cualquier usuario (§6.5)", async () => {
      const r = await base.comoUsuario(usuarioB, () =>
        base.db.query<{ n: number }>(`select count(*)::int as n from tipos_proyecto`),
      );
      expect(r.rows[0]!.n).toBe(5);
    });

    it("nadie puede modificar categorias del sistema (RF-34)", async () => {
      const afectados = await base.comoUsuario(usuarioB, () =>
        base.db.query(`update categorias set nombre = 'Hackeada' where es_sistema`),
      );
      expect(afectados.affectedRows).toBe(0);
    });

    it("el registro de auditoria es de solo lectura para el usuario", async () => {
      await expect(
        base.comoUsuario(usuarioA, () =>
          base.db.query(
            `insert into registro_auditoria (propietario_id, entidad, entidad_id, accion, actor_id)
             values ($1, 'proyectos', gen_random_uuid(), 'crear', $1)`,
            [usuarioA],
          ),
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  describe("almacenamiento de soportes (§6.7)", () => {
    it("el bucket es privado y limita el tamano a 10 MB", async () => {
      const r = await base.db.query<{ public: boolean; file_size_limit: string }>(
        `select public, file_size_limit from storage.buckets where id = 'soportes'`,
      );
      expect(r.rows[0]!.public).toBe(false);
      expect(Number(r.rows[0]!.file_size_limit)).toBe(10 * 1024 * 1024);
    });

    it("solo permite subir dentro de la carpeta del propio usuario", async () => {
      await expect(
        base.comoUsuario(usuarioB, () =>
          base.db.query(`insert into storage.objects (bucket_id, name) values ('soportes', $1)`, [
            `${usuarioA}/proyecto/factura.pdf`,
          ]),
        ),
      ).rejects.toThrow(/row-level security/i);

      const propio = await base.comoUsuario(usuarioB, () =>
        base.db.query(`insert into storage.objects (bucket_id, name) values ('soportes', $1)`, [
          `${usuarioB}/proyecto/factura.pdf`,
        ]),
      );
      expect(propio.affectedRows).toBe(1);
    });

    it("rechaza tamanos de documento superiores al limite (RF-42)", async () => {
      const proyecto = await base.db.query<{ id: string }>(
        `select id from proyectos where propietario_id = $1 limit 1`,
        [usuarioA],
      );
      await expect(
        base.db.query(
          `insert into documentos (propietario_id, proyecto_id, nombre_archivo, ruta_storage, mime_type, tamano_bytes, cargado_por)
           values ($1, $2, 'grande.pdf', $3, 'application/pdf', 10485761, $1)`,
          [usuarioA, proyecto.rows[0]!.id, `${usuarioA}/x/grande.pdf`],
        ),
      ).rejects.toThrow(/tamano_bytes/);
    });
  });
});
