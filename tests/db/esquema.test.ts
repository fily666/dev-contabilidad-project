import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearBaseDePrueba, type BaseDePrueba } from "./harness";

/**
 * Pruebas de integracion del esquema (Contexto.md §8.8): ejecutan las
 * migraciones y el seed reales contra PostgreSQL embebido y verifican
 * invariantes, formulas y el blindaje de acceso.
 *
 * Sistema monousuario (ADR-14): no hay usuarios que aislar. Lo que antes eran
 * pruebas de aislamiento por RLS son ahora pruebas de que los roles publicos de
 * Supabase no pueden tocar absolutamente nada.
 */
describe("esquema de base de datos", () => {
  let base: BaseDePrueba;

  beforeAll(async () => {
    base = await crearBaseDePrueba();
  }, 120_000);

  afterAll(async () => {
    await base?.cerrar();
  });

  describe("ajustes de la instalacion (§6.3)", () => {
    it("existe una fila con los valores por omision", async () => {
      const r = await base.db.query<{ moneda: string; zona_horaria: string }>(
        `select moneda, zona_horaria from ajustes`,
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toEqual({ moneda: "COP", zona_horaria: "America/Bogota" });
    });

    it("siembra las preferencias de RF-101", async () => {
      const r = await base.db.query<{ preferencias: Record<string, unknown> }>(
        `select preferencias from ajustes`,
      );
      expect(r.rows[0]?.preferencias).toEqual({
        formato_fecha: "d MMM yyyy",
        horizonte_proyeccion_meses: 12,
      });
    });

    it("no admite una segunda fila", async () => {
      await expect(base.db.query(`insert into ajustes (id) values (false)`)).rejects.toThrow(
        /ajustes_id_check|check constraint/i,
      );
      await expect(base.db.query(`insert into ajustes (id) values (true)`)).rejects.toThrow(
        /duplicate key/i,
      );
    });
  });

  describe("seed del catalogo (§6.8)", () => {
    it("crea los cinco tipos de proyecto del sistema", async () => {
      const r = await base.db.query<{ codigo: string }>(
        `select codigo from tipos_proyecto where es_sistema order by codigo`,
      );
      expect(r.rows.map((f) => f.codigo)).toEqual([
        "inmueble",
        "inversion",
        "negocio",
        "otro",
        "vehiculo",
      ]);
    });

    it("siembra los metodos de pago por defecto (RF-33)", async () => {
      const r = await base.db.query<{ total: number }>(
        `select count(*)::int as total from metodos_pago`,
      );
      expect(r.rows[0]!.total).toBe(4);
    });

    it("declara los atributos dinamicos del vehiculo (§13)", async () => {
      const r = await base.db.query<{ claves: string[]; genera: boolean }>(
        `select array(select jsonb_array_elements(configuracion -> 'atributos') ->> 'clave') as claves,
                (configuracion ->> 'genera_ingresos')::boolean as genera
           from tipos_proyecto where codigo = 'vehiculo'`,
      );
      expect(r.rows[0]!.claves).toContain("placa");
      expect(r.rows[0]!.claves).toContain("cilindraje");
      expect(r.rows[0]!.genera).toBe(false);
    });

    it("cubre los conceptos de los escenarios de referencia (§3)", async () => {
      const esperados = [
        "Separación",
        "Cuota inicial",
        "Gastos notariales",
        "Escrituración",
        "Remodelación",
        "Muebles",
        "Administración",
        "Impuesto predial",
        "Servicios públicos",
        "Cuotas extraordinarias",
        "Canon de arrendamiento",
        "Valor de compra",
        "Matrícula",
        "Accesorios",
        "Mantenimiento preventivo",
        "Reparaciones",
        "Combustible",
        "SOAT",
        "Revisión tecnicomecánica",
        "Impuesto vehicular",
        "Cambio de aceite",
        "Cambio de llantas",
        "Renovación de documentos",
        "Cuota de crédito",
      ];
      const r = await base.db.query<{ nombre: string }>(
        `select distinct nombre from categorias where es_sistema`,
      );
      const existentes = new Set(r.rows.map((f) => f.nombre));
      expect(esperados.filter((c) => !existentes.has(c))).toEqual([]);
    });

    it("es idempotente: reejecutarlo no duplica categorias", async () => {
      const antes = await base.db.query<{ n: number }>(`select count(*)::int as n from categorias`);
      const { readFile } = await import("node:fs/promises");
      const seed = await readFile("supabase/seed.sql", "utf8");
      await base.db.exec(seed);
      const despues = await base.db.query<{ n: number }>(
        `select count(*)::int as n from categorias`,
      );
      expect(despues.rows[0]!.n).toBe(antes.rows[0]!.n);
    });
  });

  /**
   * RF-34 sin RLS: la proteccion del catalogo del sistema paso de ser una
   * politica (que service_role omitia) a ser un trigger, que nadie omite.
   */
  describe("proteccion del catalogo del sistema (RF-34, §6.6)", () => {
    it("no permite modificar una categoria del sistema", async () => {
      await expect(
        base.db.query(`update categorias set nombre = 'Hackeada' where nombre = 'Combustible'`),
      ).rejects.toThrow(/FILA_DE_SISTEMA_NO_MODIFICABLE/);
    });

    it("no permite eliminar una categoria del sistema", async () => {
      await expect(
        base.db.query(`delete from categorias where nombre = 'Combustible'`),
      ).rejects.toThrow(/FILA_DE_SISTEMA_NO_ELIMINABLE/);
    });

    it("no permite modificar un tipo de proyecto del sistema", async () => {
      await expect(
        base.db.query(`update tipos_proyecto set nombre = 'Otro nombre' where codigo = 'inmueble'`),
      ).rejects.toThrow(/FILA_DE_SISTEMA_NO_MODIFICABLE/);
    });

    it("si permite crear, editar y borrar categorias propias", async () => {
      await base.db.query(`insert into categorias (nombre, naturaleza) values ('Propia', 'opex')`);
      const editada = await base.db.query(
        `update categorias set orden = 7 where nombre = 'Propia'`,
      );
      expect(editada.affectedRows).toBe(1);

      const borrada = await base.db.query(`delete from categorias where nombre = 'Propia'`);
      expect(borrada.affectedRows).toBe(1);
    });

    it("no permite promover una categoria propia a categoria del sistema", async () => {
      await base.db.query(
        `insert into categorias (nombre, naturaleza) values ('Ascendida', 'opex')`,
      );
      await expect(
        base.db.query(`update categorias set es_sistema = true where nombre = 'Ascendida'`),
      ).rejects.toThrow(/FILA_DE_SISTEMA_NO_MODIFICABLE/);
      await base.db.query(`delete from categorias where nombre = 'Ascendida'`);
    });
  });

  describe("invariantes del dominio en base de datos (§5.7)", () => {
    let proyecto: string;
    let categoriaCanon: string;
    let categoriaPredial: string;

    beforeAll(async () => {
      const p = await base.db.query<{ id: string }>(
        `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
         select id, 'Apartamento 401', '2026-01-15' from tipos_proyecto where codigo = 'inmueble'
         returning id`,
      );
      proyecto = p.rows[0]!.id;

      const c1 = await base.db.query<{ id: string }>(
        `select id from categorias where nombre = 'Canon de arrendamiento'`,
      );
      categoriaCanon = c1.rows[0]!.id;
      const c2 = await base.db.query<{ id: string }>(
        `select id from categorias where nombre = 'Impuesto predial'`,
      );
      categoriaPredial = c2.rows[0]!.id;
    });

    it("rechaza valores no positivos (§5.7.2)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion)
           values ($1, $2, 'egreso', 'opex', '2026-02-01', 0, 'Predial')`,
          [proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/valor/i);
    });

    it("rechaza una categoria de ingreso en un egreso (§5.7.3)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion)
           values ($1, $2, 'egreso', 'opex', '2026-02-01', 100000, 'Canon como egreso')`,
          [proyecto, categoriaCanon],
        ),
      ).rejects.toThrow(/CATEGORIA_INCOMPATIBLE/);
    });

    it("exige fecha de pago cuando el estado es pagado (§5.7.4)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, estado)
           values ($1, $2, 'egreso', 'opex', '2026-02-01', 100000, 'Predial', 'pagado')`,
          [proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/pagado_requiere_fecha/);
    });

    it("exige motivo al anular (RF-22)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion, estado)
           values ($1, $2, 'egreso', 'opex', '2026-02-01', 100000, 'Predial', 'anulado')`,
          [proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/anulado_requiere_motivo/);
    });

    it("rechaza moneda distinta a la del proyecto (§5.7.5)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, moneda, descripcion)
           values ($1, $2, 'egreso', 'opex', '2026-02-01', 100000, 'USD', 'Predial')`,
          [proyecto, categoriaPredial],
        ),
      ).rejects.toThrow(/MONEDA_INCOMPATIBLE/);
    });

    it("rechaza movimientos en un proyecto finalizado (§5.7.7)", async () => {
      const cerrado = await base.db.query<{ id: string }>(
        `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio, estado)
         select id, 'Proyecto cerrado', '2025-01-01', 'finalizado'
           from tipos_proyecto where codigo = 'otro'
         returning id`,
      );
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, descripcion)
           values ($1, $2, 'egreso', 'opex', '2026-02-01', 100000, 'Gasto')`,
          [cerrado.rows[0]!.id, categoriaPredial],
        ),
      ).rejects.toThrow(/PROYECTO_CERRADO/);
    });

    it("valida el desglose de cuota de credito (RF-29)", async () => {
      await expect(
        base.db.query(
          `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, valor, abono_capital, abono_interes, descripcion)
           select $1, id, 'egreso', 'financiacion', '2026-02-01', 1000000, 400000, 400000, 'Cuota'
             from categorias where nombre = 'Cuota de crédito'`,
          [proyecto],
        ),
      ).rejects.toThrow(/desglose_credito/);
    });
  });

  describe("agregados y formulas (§5.1, §6.4)", () => {
    let proyecto: string;

    beforeAll(async () => {
      const p = await base.db.query<{ id: string }>(
        `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
         select id, 'Apartamento con cifras', '2026-01-01'
           from tipos_proyecto where codigo = 'inmueble'
         returning id`,
      );
      proyecto = p.rows[0]!.id;

      // capex pagado 60.000.000 | opex pagado 500.000 | ingreso pagado 2.000.000
      // + un opex PENDIENTE de 9.999.999 que NO debe entrar en las cifras de caja
      await base.db.exec(`
        insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado)
        select '${proyecto}', c.id, 'egreso', 'capex', '2026-01-10', '2026-01-10', 60000000, 'Cuota inicial', 'pagado'
          from categorias c where c.nombre = 'Cuota inicial';

        insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado)
        select '${proyecto}', c.id, 'egreso', 'opex', '2026-02-05', '2026-02-05', 500000, 'Administracion febrero', 'pagado'
          from categorias c where c.nombre = 'Administración';

        insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado)
        select '${proyecto}', c.id, 'ingreso', 'ingreso', '2026-02-05', '2026-02-05', 2000000, 'Canon febrero', 'pagado'
          from categorias c where c.nombre = 'Canon de arrendamiento';

        insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_vencimiento, valor, descripcion, estado)
        select '${proyecto}', c.id, 'egreso', 'opex', '2026-03-01', '2026-03-10', 9999999, 'Predial pendiente', 'pendiente'
          from categorias c where c.nombre = 'Impuesto predial';
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

  describe("borrado de un proyecto", () => {
    it("un proyecto sin movimientos se elimina y queda auditado", async () => {
      const proyecto = await base.db.query<{ id: string }>(
        `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
         select id, 'Proyecto vacio', '2026-01-01' from tipos_proyecto where codigo = 'otro'
         returning id`,
      );

      await base.db.query(`delete from proyectos where id = $1`, [proyecto.rows[0]!.id]);

      const auditoria = await base.db.query<{ n: number }>(
        `select count(*)::int as n from registro_auditoria
          where entidad = 'proyectos' and entidad_id = $1 and accion = 'eliminar'`,
        [proyecto.rows[0]!.id],
      );
      expect(auditoria.rows[0]!.n).toBe(1);
    });

    /** §6.3: on delete restrict. Un proyecto con historia no se borra por accidente. */
    it("un proyecto con movimientos no se puede eliminar", async () => {
      const proyecto = await base.db.query<{ id: string }>(
        `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
         select id, 'Proyecto con historia', '2026-01-01' from tipos_proyecto where codigo = 'otro'
         returning id`,
      );
      await base.db.query(
        `insert into movimientos (proyecto_id, categoria_id, tipo, naturaleza, fecha, fecha_pago, valor, descripcion, estado)
         select $1, c.id, 'egreso', 'opex', '2026-02-01', '2026-02-01', 250000, 'Gasto', 'pagado'
           from categorias c where c.nombre = 'Otros egresos' limit 1`,
        [proyecto.rows[0]!.id],
      );

      await expect(
        base.db.query(`delete from proyectos where id = $1`, [proyecto.rows[0]!.id]),
      ).rejects.toThrow(/violates RESTRICT setting of foreign key/i);
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
        `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
         select id, 'Moto XR', '2026-06-01' from tipos_proyecto where codigo = 'vehiculo'
         returning id`,
      );

      await base.db.query(
        `insert into obligaciones (proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento, frecuencia)
         select $1, c.id, 'SOAT', 550000, (current_date + 30), 'anual'
           from categorias c where c.nombre = 'SOAT'`,
        [proyecto.rows[0]!.id],
      );
      await base.db.query(
        `insert into obligaciones (proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento, frecuencia)
         select $1, c.id, 'Cambio de aceite', 120000, (current_date + 15), 'trimestral'
           from categorias c where c.nombre = 'Cambio de aceite'`,
        [proyecto.rows[0]!.id],
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
        `select id from proyectos where nombre = 'Moto XR' limit 1`,
      );
      await base.db.query(
        `insert into obligaciones (proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento, frecuencia)
         select $1, c.id, 'Impuesto vencido', 90000, (current_date - 40), 'unica'
           from categorias c where c.nombre = 'Impuesto vehicular'`,
        [proyecto.rows[0]!.id],
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

  /**
   * El nucleo de la seguridad del esquema monousuario (RNF-11, §9): la clave
   * publicable de Supabase no debe servir para nada. Si alguna de estas pruebas
   * falla, la base quedo expuesta a cualquiera que conozca la URL del proyecto.
   */
  describe("blindaje frente a los roles publicos (§6.5, §9)", () => {
    const TABLAS = [
      "ajustes",
      "tipos_proyecto",
      "proyectos",
      "categorias",
      "metodos_pago",
      "movimientos",
      "obligaciones",
      "ocurrencias_obligacion",
      "documentos",
      "pasivos",
      "valoraciones",
      "presupuestos",
      "notificaciones",
      "registro_auditoria",
    ];

    it("RLS esta activo en las catorce tablas", async () => {
      const r = await base.db.query<{ tabla: string }>(
        `select tablename as tabla from pg_tables
          where schemaname = 'public' and not rowsecurity`,
      );
      expect(r.rows.map((f) => f.tabla)).toEqual([]);

      const total = await base.db.query<{ n: number }>(
        `select count(*)::int as n from pg_tables where schemaname = 'public'`,
      );
      expect(total.rows[0]!.n).toBe(TABLAS.length);
    });

    it("no existe ninguna politica: la denegacion es por omision", async () => {
      const r = await base.db.query<{ n: number }>(
        `select count(*)::int as n from pg_policies where schemaname = 'public'`,
      );
      expect(r.rows[0]!.n).toBe(0);
    });

    it("anon y authenticated no tienen ni un permiso sobre las tablas", async () => {
      const r = await base.db.query<{
        grantee: string;
        table_name: string;
        privilege_type: string;
      }>(
        `select grantee, table_name, privilege_type
           from information_schema.role_table_grants
          where table_schema = 'public' and grantee in ('anon', 'authenticated')`,
      );
      expect(r.rows).toEqual([]);
    });

    /**
     * Verifica que ALTER DEFAULT PRIVILEGES surtio efecto. Sin eso, la proxima
     * tabla o funcion que se agregue nace concedida a los roles publicos (a las
     * funciones PostgreSQL les da EXECUTE a PUBLIC) y el blindaje se erosiona
     * migracion a migracion sin que nadie lo note.
     */
    it("un objeto nuevo en public tampoco queda al alcance de anon", async () => {
      await base.db.exec(`
        create table prueba_blindaje (id int primary key);
        create function prueba_blindaje_fn() returns int language sql as $$ select 1 $$;
      `);

      try {
        await expect(
          base.comoRol("anon", () => base.db.query(`select * from prueba_blindaje`)),
        ).rejects.toThrow(/permission denied/i);

        await expect(
          base.comoRol("anon", () => base.db.query(`select prueba_blindaje_fn()`)),
        ).rejects.toThrow(/permission denied/i);
      } finally {
        await base.db.exec(`drop function prueba_blindaje_fn; drop table prueba_blindaje;`);
      }
    });

    for (const tabla of ["proyectos", "movimientos", "ajustes", "registro_auditoria"]) {
      it(`anon no puede leer ${tabla}`, async () => {
        await expect(
          base.comoRol("anon", () => base.db.query(`select * from ${tabla}`)),
        ).rejects.toThrow(/permission denied/i);
      });
    }

    it("authenticated tampoco puede escribir", async () => {
      await expect(
        base.comoRol("authenticated", () =>
          base.db.query(
            `insert into proyectos (tipo_proyecto_id, nombre, fecha_inicio)
             select id, 'Inyectado', '2026-01-01' from tipos_proyecto limit 1`,
          ),
        ),
      ).rejects.toThrow(/permission denied/i);
    });

    it("las vistas no son una puerta de atras", async () => {
      await expect(
        base.comoRol("anon", () => base.db.query(`select * from v_resumen_proyecto`)),
      ).rejects.toThrow(/permission denied/i);
    });

    it("las funciones no son invocables por los roles publicos", async () => {
      await expect(
        base.comoRol("anon", () => base.db.query(`select marcar_vencidos()`)),
      ).rejects.toThrow(/permission denied/i);
    });

    it("service_role si conserva acceso: es por donde entra la aplicacion", async () => {
      const r = await base.comoRol("service_role", () =>
        base.db.query<{ n: number }>(`select count(*)::int as n from proyectos`),
      );
      expect(r.rows[0]!.n).toBeGreaterThan(0);
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

    it("storage.objects no tiene politicas: solo se opera con service_role", async () => {
      const r = await base.db.query<{ n: number }>(
        `select count(*)::int as n from pg_policies
          where schemaname = 'storage' and tablename = 'objects'`,
      );
      expect(r.rows[0]!.n).toBe(0);
    });

    it("rechaza tamanos de documento superiores al limite (RF-42)", async () => {
      const proyecto = await base.db.query<{ id: string }>(`select id from proyectos limit 1`);
      await expect(
        base.db.query(
          `insert into documentos (proyecto_id, nombre_archivo, ruta_storage, mime_type, tamano_bytes)
           values ($1, 'grande.pdf', $2, 'application/pdf', 10485761)`,
          [proyecto.rows[0]!.id, `${proyecto.rows[0]!.id}/grande.pdf`],
        ),
      ).rejects.toThrow(/tamano_bytes/);
    });
  });
});
