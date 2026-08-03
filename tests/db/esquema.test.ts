import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

    it("siembra las preferencias de RF-101 y RF-102", async () => {
      const r = await base.db.query<{ preferencias: Record<string, unknown> }>(
        `select preferencias from ajustes`,
      );
      expect(r.rows[0]?.preferencias).toEqual({
        formato_fecha: "d MMM yyyy",
        horizonte_proyeccion_meses: 12,
        // RF-102: la instalacion nace avisando solo dentro de la aplicacion; el
        // correo se activa cuando haya destinatario y credenciales (§15.1).
        canales_notificacion: ["in_app"],
        dias_aviso_por_omision: [5, 1],
        email_destino: null,
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
    it("crea los tipos de proyecto del sistema, incluidos los de la Fase 5", async () => {
      const r = await base.db.query<{ codigo: string }>(
        `select codigo from tipos_proyecto where es_sistema order by codigo`,
      );
      expect(r.rows.map((f) => f.codigo)).toEqual([
        "construccion",
        "cripto",
        "inmueble",
        "inversion",
        "negocio",
        "otro",
        "vehiculo",
        "viaje",
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
   * §8.5: la fecha de negocio sale de `ajustes`, no del reloj UTC del servidor.
   *
   * Estas pruebas son deliberadamente independientes de la hora a la que corran,
   * que es lo dificil de este defecto: con `current_date` la base solo se
   * equivocaba entre las 19:00 y la medianoche de Bogota, asi que una prueba
   * ingenua pasaba diecinueve horas al dia. El truco es comparar dos zonas
   * separadas VEINTICINCO horas —Kiritimati (UTC+14) y Niue (UTC-11)—: en
   * cualquier instante estan en dias distintos del calendario, siempre.
   */
  describe("fecha de negocio desde ajustes (§8.5)", () => {
    async function conZona<T>(zona: string, fn: () => Promise<T>): Promise<T> {
      await base.db.query(`update ajustes set zona_horaria = $1`, [zona]);
      try {
        return await fn();
      } finally {
        await base.db.query(`update ajustes set zona_horaria = 'America/Bogota'`);
      }
    }

    const hoyDeNegocio = async () =>
      (await base.db.query<{ f: string }>(`select fecha_de_negocio()::text as f`)).rows[0]!.f;

    /**
     * `current_date` NO es UTC: es la fecha en la zona horaria de la SESIÓN.
     *
     * Esta prueba lo descubrió fallando: PGlite hereda la zona del proceso, así
     * que en una máquina en Bogotá `current_date` daba el 31 de julio mientras
     * `now() at time zone 'UTC'` ya daba el 1 de agosto. La primera versión
     * comparaba las dos sin fijar la zona de sesión y pasaba o fallaba según la
     * hora y la máquina.
     *
     * Fijarla a UTC es además reproducir la condición real: Supabase abre las
     * sesiones en UTC, y de ahí venía el defecto que la migración corrige.
     */
    it("coincide con current_date cuando la sesion y ajustes estan ambas en UTC", async () => {
      await base.db.query(`set time zone 'UTC'`);
      try {
        const [negocio, sesion] = await conZona("UTC", async () => [
          await hoyDeNegocio(),
          (await base.db.query<{ f: string }>(`select current_date::text as f`)).rows[0]!.f,
        ]);

        expect(negocio).toBe(sesion);
      } finally {
        await base.db.query(`set time zone 'America/Bogota'`);
      }
    });

    /**
     * La prueba que fija el defecto: con la sesión en UTC —como en Supabase— y
     * `ajustes` en una zona que va un día por detrás, la fecha de negocio NO puede
     * ser la de la sesión. Con `current_date` lo era, y de ahí salían los
     * vencimientos adelantados.
     */
    it("con la sesion en UTC, la fecha de negocio sigue a ajustes y no a la sesion", async () => {
      await base.db.query(`set time zone 'UTC'`);
      try {
        const sesion = (await base.db.query<{ f: string }>(`select current_date::text as f`))
          .rows[0]!.f;
        const negocio = await conZona("Pacific/Niue", hoyDeNegocio);

        // Niue (UTC-11) nunca comparte fecha con UTC más de trece horas al día;
        // lo que sí es siempre cierto es que nunca va por delante.
        expect(negocio <= sesion).toBe(true);
      } finally {
        await base.db.query(`set time zone 'America/Bogota'`);
      }
    });

    it("cambia con la zona configurada, a cualquier hora del dia", async () => {
      const adelante = await conZona("Pacific/Kiritimati", hoyDeNegocio);
      const atras = await conZona("Pacific/Niue", hoyDeNegocio);

      // 25 horas de separacion: nunca comparten fecha.
      expect(adelante).not.toBe(atras);
      expect(adelante > atras).toBe(true);
    });

    it("degrada a America/Bogota si ajustes no tiene fila", async () => {
      // Sin `security definer` (§6.6), un rol sin acceso a `ajustes` recibe cero
      // filas del subselect. El mismo camino que una base migrada sin sembrar.
      const esperado = (
        await base.db.query<{ f: string }>(
          `select (now() at time zone 'America/Bogota')::date::text as f`,
        )
      ).rows[0]!.f;

      // En transaccion con rollback: borrar la fila unica de ajustes y dejarla
      // borrada rompería las pruebas que vienen despues.
      await base.db.query(`begin`);
      let sinFila: string;
      try {
        await base.db.query(`delete from ajustes`);
        sinFila = await hoyDeNegocio();
      } finally {
        await base.db.query(`rollback`);
      }

      expect(sinFila).toBe(esperado);
    });

    it("v_agenda_obligaciones cuenta dias_restantes desde esa fecha", async () => {
      const leerDias = async () =>
        (
          await base.db.query<{ d: number }>(
            `select dias_restantes as d from v_agenda_obligaciones
              where concepto = 'SOAT' limit 1`,
          )
        ).rows[0]!.d;

      const adelante = await conZona("Pacific/Kiritimati", leerDias);
      const atras = await conZona("Pacific/Niue", leerDias);

      // Si la vista siguiera anclada a current_date, las dos serian iguales.
      expect(adelante).not.toBe(atras);
      expect(atras).toBeGreaterThan(adelante);
    });
  });

  /**
   * §10.2, RF-59. La lectura de un aviso es un eje distinto de su envio, y la base
   * es la que lo sostiene: sin la restriccion, nada impediria anotar como «leido»
   * un correo, que se lee en el cliente de correo y de eso aqui no se sabe nada.
   */
  describe("bandeja de avisos in-app (§10.2)", () => {
    async function insertar(canal: string, leidaEn: string | null): Promise<void> {
      await base.db.query(
        `insert into notificaciones (canal, asunto, cuerpo, programada_para, leida_en)
         values ($1, 'Aviso de prueba', 'cuerpo', now(), $2)`,
        [canal, leidaEn],
      );
    }

    it("acepta leida_en en el canal in_app", async () => {
      await base.db.query(`begin`);
      try {
        await expect(insertar("in_app", new Date().toISOString())).resolves.toBeUndefined();
      } finally {
        await base.db.query(`rollback`);
      }
    });

    it("rechaza leida_en en los canales que no se leen aqui", async () => {
      await base.db.query(`begin`);
      try {
        await expect(insertar("email", new Date().toISOString())).rejects.toThrow(
          /notificaciones_solo_in_app_se_lee/,
        );
      } finally {
        await base.db.query(`rollback`);
      }
    });

    it("un aviso nace sin leer, en cualquier canal", async () => {
      await base.db.query(`begin`);
      try {
        await insertar("email", null);
        await insertar("in_app", null);
        // Acotado al asunto de prueba: contar la tabla entera ataria el resultado
        // al orden de las demas pruebas.
        const r = await base.db.query<{ n: number }>(
          `select count(*)::int as n from notificaciones
            where asunto = 'Aviso de prueba' and leida_en is null`,
        );
        expect(r.rows[0]!.n).toBe(2);
      } finally {
        await base.db.query(`rollback`);
      }
    });

    /**
     * §10.1. La prueba que faltaba, y que habria ahorrado el defecto: el adaptador
     * programa con `upsert ... on conflict (ocurrencia_id, canal, programada_para)`,
     * y el indice unico nacio PARCIAL (`where ocurrencia_id is not null`).
     * PostgreSQL no infiere un indice parcial sin que la sentencia repita su
     * predicado, y PostgREST no puede enviarlo: la tarea diaria respondia 42P10 y
     * no programaba ni un aviso. Se verifica el `on conflict` real, no la
     * existencia del indice, porque el indice existia y aun asi no servia.
     */
    it("la tarea diaria puede programar un aviso de ocurrencia sin repetir el predicado", async () => {
      await base.db.query(`begin`);
      try {
        const ocurrencia = (
          await base.db.query<{ id: string }>(`select id from ocurrencias_obligacion limit 1`)
        ).rows[0]!.id;

        const programar = () =>
          base.db.query<{ id: string }>(
            `insert into notificaciones (ocurrencia_id, canal, asunto, cuerpo, programada_para)
             values ($1, 'in_app', 'Aviso de prueba', 'cuerpo', '2026-08-01T12:00:00Z')
             on conflict (ocurrencia_id, canal, programada_para) do nothing
             returning id`,
            [ocurrencia],
          );

        const primera = await programar();
        const segunda = await programar();

        // La segunda no inserta: eso es la idempotencia que §10.1 promete.
        expect(primera.rows).toHaveLength(1);
        expect(segunda.rows).toHaveLength(0);
      } finally {
        await base.db.query(`rollback`);
      }
    });

    it("el resumen semanal, que va sin ocurrencia, tambien es idempotente", async () => {
      // `nulls not distinct`: con nulos distintos, dos ejecuciones del mismo lunes
      // programaban dos resumenes (§10.3).
      await base.db.query(`begin`);
      try {
        const programar = () =>
          base.db.query<{ id: string }>(
            `insert into notificaciones (ocurrencia_id, canal, asunto, cuerpo, programada_para)
             values (null, 'email', 'Resumen de prueba', 'cuerpo', '2026-08-03T12:00:00Z')
             on conflict (ocurrencia_id, canal, programada_para) do nothing
             returning id`,
          );

        expect((await programar()).rows).toHaveLength(1);
        expect((await programar()).rows).toHaveLength(0);
      } finally {
        await base.db.query(`rollback`);
      }
    });

    it("el indice de la campana existe y es el parcial que espera el adaptador", async () => {
      // Si alguien lo convierte en indice completo o le cambia el predicado, la
      // consulta de `bandeja()` deja de usarlo y nadie lo nota hasta que la tabla
      // crece. El predicado se compara por su contenido, no por su texto exacto.
      const r = await base.db.query<{ definicion: string }>(
        `select indexdef as definicion from pg_indexes
          where schemaname = 'public' and indexname = 'notificaciones_bandeja_idx'`,
      );

      const definicion = r.rows[0]?.definicion ?? "";
      expect(definicion).toContain("in_app");
      expect(definicion).toContain("cancelada");
      expect(definicion).toContain("programada_para DESC");
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
    it("el bucket es privado y limita el tamano a 20 MB", async () => {
      const r = await base.db.query<{ public: boolean; file_size_limit: string }>(
        `select public, file_size_limit from storage.buckets where id = 'soportes'`,
      );
      expect(r.rows[0]!.public).toBe(false);
      expect(Number(r.rows[0]!.file_size_limit)).toBe(20 * 1024 * 1024);
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
           values ($1, 'grande.pdf', $2, 'application/pdf', 20971521)`,
          [proyecto.rows[0]!.id, `${proyecto.rows[0]!.id}/grande.pdf`],
        ),
      ).rejects.toThrow(/tamano_bytes/);
    });
  });

  describe("tareas programadas en la base (§10.1)", () => {
    /** Las dos tareas que dejaron Vercel Cron por el limite del plan Hobby. */
    async function tareas() {
      const r = await base.db.query<{ jobname: string; schedule: string; command: string }>(
        `select jobname, schedule, command from cron.job order by schedule`,
      );
      return r.rows;
    }

    it("declara las dos tareas diarias con su horario en UTC", async () => {
      expect(await tareas()).toMatchObject([
        { jobname: "generar-ocurrencias", schedule: "0 9 * * *" },
        { jobname: "marcar-vencidos", schedule: "5 9 * * *" },
      ]);
    });

    it("genera las ocurrencias antes de marcar los vencidos", async () => {
      // El orden es la razon del cambio: en Vercel los minutos escalonados no lo
      // garantizaban. Aqui si, y la prueba lo fija para que nadie los reordene
      // creyendo que el intervalo es lo unico que importa.
      const [primera, segunda] = await tareas();
      expect(primera!.jobname).toBe("generar-ocurrencias");
      expect(segunda!.jobname).toBe("marcar-vencidos");
    });

    it("no adelanta las tareas al dia de negocio anterior (§8.5)", async () => {
      // La fecha de negocio cambia de dia a las 05:00 UTC. Una tarea antes de esa
      // hora compara contra el hoy de ayer y deja un dia de vencidos sin marcar.
      for (const tarea of await tareas()) {
        const hora = Number(tarea.schedule.split(" ")[1]);
        expect(hora).toBeGreaterThanOrEqual(5);
      }
    });

    it("cualifica los nombres con public. porque pg_cron no hereda el search_path", async () => {
      for (const tarea of await tareas()) {
        expect(tarea.command).toMatch(/public\./);
      }
    });

    it("lee el horizonte de ajustes y no de una constante", async () => {
      const [generar] = await tareas();
      expect(generar!.command).toContain("horizonte_proyeccion_meses");

      // Y el comando debe funcionar: es lo que la tarea ejecutara cada dia.
      const r = await base.db.query<{ generar_ocurrencias: number }>(generar!.command);
      expect(typeof r.rows[0]!.generar_ocurrencias).toBe("number");
    });

    it("cierra el esquema cron a los tres roles de la aplicacion (§6.5)", async () => {
      const r = await base.db.query<{ rol: string; puede: boolean }>(
        `select rol, has_schema_privilege(rol, 'cron', 'usage') as puede
           from unnest(array['anon', 'authenticated', 'service_role']) as rol`,
      );
      expect(r.rows).toHaveLength(3);
      for (const fila of r.rows) expect(fila.puede).toBe(false);
    });

    // Va al final del archivo a proposito: reaplica una migracion y deja el
    // estado tocado.
    it("reaplicar la migracion no duplica las tareas", async () => {
      // Un trabajo duplicado no es un error visible: es la misma tarea corriendo
      // dos veces. Por eso la migracion desprograma antes de crear, y por eso la
      // propiedad se verifica en lugar de confiar en la version de pg_cron.
      const sql = await readFile(
        join(process.cwd(), "supabase/migrations/20260803120000_tareas_en_postgres.sql"),
        "utf8",
      );
      await base.db.exec(sql);

      expect(await tareas()).toHaveLength(2);
    });
  });
});
