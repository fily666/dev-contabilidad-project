import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Pasivo } from "../domain/pasivo.entity";
import { Valoracion } from "../domain/valoracion.entity";
import type {
  PasivoListado,
  PasivoRepository,
  PatrimonioProyecto,
  ValoracionListada,
  ValoracionRepository,
} from "../domain/patrimonio.repository";

type FilaPasivo = Tablas<"pasivos">;
type FilaValoracion = Tablas<"valoraciones">;

function aPasivo(fila: FilaPasivo): Pasivo {
  return Pasivo.desdePersistencia({
    id: fila.id,
    proyectoId: fila.proyecto_id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    montoOriginal: Number(fila.monto_original),
    saldoActual: Number(fila.saldo_actual),
    tasaInteresEa: fila.tasa_interes_ea === null ? null : Number(fila.tasa_interes_ea),
    plazoMeses: fila.plazo_meses,
    valorCuota: fila.valor_cuota === null ? null : Number(fila.valor_cuota),
    fechaDesembolso: fila.fecha_desembolso,
    activo: fila.activo,
  });
}

function aValoracion(fila: FilaValoracion): Valoracion {
  return Valoracion.desdePersistencia({
    id: fila.id,
    proyectoId: fila.proyecto_id,
    fecha: fila.fecha,
    valor: Number(fila.valor),
    fuente: fila.fuente,
    notas: fila.notas,
  });
}

/**
 * ADAPTADOR del puerto PasivoRepository (Contexto.md §7.3, RF-17).
 *
 * Van en clases separadas y no en una sola: pasivos y valoraciones son dos
 * puertos con los mismos nombres de metodo, y juntarlos obligaria a renombrarlos
 * —`buscarValoracionPorId`— rompiendo el contrato del puerto para acomodar la
 * implementacion, que es exactamente lo que la hexagonal evita.
 */
export class SupabasePasivoRepository implements PasivoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string): Promise<Pasivo | null> {
    const { data, error } = await this.supabase
      .from("pasivos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aPasivo(data) : null;
  }

  async listar(
    filtro: { proyectoId?: string; soloActivos?: boolean } = {},
  ): Promise<PasivoListado[]> {
    let consulta = this.supabase
      .from("pasivos")
      .select("*, proyectos!inner ( nombre, moneda )")
      .order("fecha_desembolso", { ascending: false });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.soloActivos) consulta = consulta.eq("activo", true);

    const { data, error } = await consulta;
    if (error) throw error;

    type Fila = FilaPasivo & { proyectos: { nombre: string; moneda: string } | null };

    return ((data ?? []) as unknown as Fila[]).map((f) => {
      const pasivo = aPasivo(f);
      return {
        id: f.id,
        proyectoId: f.proyecto_id,
        proyectoNombre: f.proyectos?.nombre ?? "—",
        nombre: f.nombre,
        tipo: f.tipo,
        montoOriginal: Number(f.monto_original),
        saldoActual: Number(f.saldo_actual),
        tasaInteresEa: f.tasa_interes_ea === null ? null : Number(f.tasa_interes_ea),
        plazoMeses: f.plazo_meses,
        valorCuota: f.valor_cuota === null ? null : Number(f.valor_cuota),
        fechaDesembolso: f.fecha_desembolso,
        activo: f.activo,
        moneda: f.proyectos?.moneda ?? "COP",
        amortizado: pasivo.amortizado,
      };
    });
  }

  async guardar(pasivo: Pasivo): Promise<Pasivo> {
    const d = pasivo.aDatos();
    const { data, error } = await this.supabase
      .from("pasivos")
      .insert({
        id: d.id,
        proyecto_id: d.proyectoId,
        nombre: d.nombre,
        tipo: d.tipo,
        monto_original: d.montoOriginal,
        saldo_actual: d.saldoActual,
        tasa_interes_ea: d.tasaInteresEa,
        plazo_meses: d.plazoMeses,
        valor_cuota: d.valorCuota,
        fecha_desembolso: d.fechaDesembolso,
        activo: d.activo,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aPasivo(data);
  }

  async actualizar(pasivo: Pasivo): Promise<Pasivo> {
    const d = pasivo.aDatos();
    const { data, error } = await this.supabase
      .from("pasivos")
      .update({
        nombre: d.nombre,
        tipo: d.tipo,
        monto_original: d.montoOriginal,
        saldo_actual: d.saldoActual,
        tasa_interes_ea: d.tasaInteresEa,
        plazo_meses: d.plazoMeses,
        valor_cuota: d.valorCuota,
        fecha_desembolso: d.fechaDesembolso,
        activo: d.activo,
      })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aPasivo(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("pasivos").delete().eq("id", id);
    if (error) throw error;
  }
}

/** ADAPTADOR del puerto ValoracionRepository (Contexto.md §7.3, RF-16, RF-78). */
export class SupabaseValoracionRepository implements ValoracionRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string): Promise<Valoracion | null> {
    const { data, error } = await this.supabase
      .from("valoraciones")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aValoracion(data) : null;
  }

  async listar(filtro: { proyectoId?: string } = {}): Promise<ValoracionListada[]> {
    let consulta = this.supabase
      .from("valoraciones")
      .select("*, proyectos!inner ( moneda )")
      .order("fecha", { ascending: false });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);

    const { data, error } = await consulta;
    if (error) throw error;

    type Fila = FilaValoracion & { proyectos: { moneda: string } | null };

    return ((data ?? []) as unknown as Fila[]).map((f) => ({
      id: f.id,
      proyectoId: f.proyecto_id,
      fecha: f.fecha,
      valor: Number(f.valor),
      fuente: f.fuente,
      notas: f.notas,
      moneda: f.proyectos?.moneda ?? "COP",
    }));
  }

  async guardar(valoracion: Valoracion): Promise<Valoracion> {
    const d = valoracion.aDatos();
    // `upsert` sobre (proyecto_id, fecha): registrar dos veces el mismo dia es
    // corregir el valor, no crear una segunda valoracion (§6.3).
    const { data, error } = await this.supabase
      .from("valoraciones")
      .upsert(
        {
          id: d.id,
          proyecto_id: d.proyectoId,
          fecha: d.fecha,
          valor: d.valor,
          fuente: d.fuente,
          notas: d.notas,
        },
        { onConflict: "proyecto_id,fecha" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return aValoracion(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("valoraciones").delete().eq("id", id);
    if (error) throw error;
  }

  /** RF-78: se combinan las dos vistas de §6.4 con la cabecera del proyecto. */
  async patrimonio(filtro: { proyectoId?: string } = {}): Promise<PatrimonioProyecto[]> {
    let consultaProyectos = this.supabase
      .from("proyectos")
      .select("id, nombre, estado, moneda")
      .neq("estado", "archivado");
    let consultaPatrimonio = this.supabase.from("v_patrimonio_proyecto").select("*");
    let consultaResumen = this.supabase
      .from("v_resumen_proyecto")
      .select("proyecto_id, total_invertido, total_ingresos, total_egresos");

    if (filtro.proyectoId) {
      consultaProyectos = consultaProyectos.eq("id", filtro.proyectoId);
      consultaPatrimonio = consultaPatrimonio.eq("proyecto_id", filtro.proyectoId);
      consultaResumen = consultaResumen.eq("proyecto_id", filtro.proyectoId);
    }

    const [proyectos, patrimonio, resumen] = await Promise.all([
      consultaProyectos,
      consultaPatrimonio,
      consultaResumen,
    ]);

    if (proyectos.error) throw proyectos.error;
    if (patrimonio.error) throw patrimonio.error;
    if (resumen.error) throw resumen.error;

    const porPatrimonio = new Map((patrimonio.data ?? []).map((f) => [f.proyecto_id, f]));
    const porResumen = new Map((resumen.data ?? []).map((f) => [f.proyecto_id, f]));

    return (proyectos.data ?? []).map((proyecto) => {
      const p = porPatrimonio.get(proyecto.id);
      const r = porResumen.get(proyecto.id);

      return {
        proyectoId: proyecto.id,
        proyecto: proyecto.nombre,
        estado: proyecto.estado,
        moneda: proyecto.moneda,
        valoracionActual: p?.valoracion_actual === null ? null : Number(p?.valoracion_actual ?? 0),
        valoracionFecha: p?.valoracion_fecha ?? null,
        pasivoTotal: Number(p?.pasivo_total ?? 0),
        patrimonioNeto: Number(p?.patrimonio_neto ?? 0),
        totalInvertido: Number(r?.total_invertido ?? 0),
        totalIngresos: Number(r?.total_ingresos ?? 0),
        totalEgresos: Number(r?.total_egresos ?? 0),
      };
    });
  }
}
