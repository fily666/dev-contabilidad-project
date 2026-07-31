import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Notificacion } from "../domain/notificacion.entity";
import type {
  NotificacionListada,
  NotificacionRepository,
} from "../domain/notificacion.repository";

type Fila = Tablas<"notificaciones">;

function aNotificacion(fila: Fila): Notificacion {
  return Notificacion.desdePersistencia({
    id: fila.id,
    ocurrenciaId: fila.ocurrencia_id,
    canal: fila.canal,
    asunto: fila.asunto,
    cuerpo: fila.cuerpo,
    programadaPara: fila.programada_para,
    enviadaEn: fila.enviada_en,
    estado: fila.estado,
    error: fila.error,
    intentos: fila.intentos,
  });
}

/** ADAPTADOR del puerto NotificacionRepository (Contexto.md §7.3, §10). */
export class SupabaseNotificacionRepository implements NotificacionRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async pendientesDeEnvio(ahora: Date, limite = 50): Promise<Notificacion[]> {
    const { data, error } = await this.supabase
      .from("notificaciones")
      .select("*")
      .in("estado", ["programada", "fallida"])
      .lte("programada_para", ahora.toISOString())
      .lt("intentos", 3)
      .order("programada_para", { ascending: true })
      .limit(limite);

    if (error) throw error;
    return (data ?? []).map(aNotificacion);
  }

  async listar(
    filtro: {
      estados?: Fila["estado"][];
      canal?: Fila["canal"];
      limite?: number;
    } = {},
  ): Promise<NotificacionListada[]> {
    let consulta = this.supabase
      .from("notificaciones")
      .select("*")
      .order("programada_para", { ascending: false })
      .limit(filtro.limite ?? 20);

    if (filtro.estados?.length) consulta = consulta.in("estado", filtro.estados);
    if (filtro.canal) consulta = consulta.eq("canal", filtro.canal);

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((f) => ({
      id: f.id,
      ocurrenciaId: f.ocurrencia_id,
      canal: f.canal,
      asunto: f.asunto,
      programadaPara: f.programada_para,
      enviadaEn: f.enviada_en,
      estado: f.estado,
      intentos: f.intentos,
      error: f.error,
    }));
  }

  /**
   * §10.1: idempotencia. El indice unico `(ocurrencia_id, canal, programada_para)`
   * de §6.3 es quien decide; `ignoreDuplicates` convierte el choque en un no-op y
   * la fila devuelta vacia nos dice que ya estaba.
   */
  async programarSiFalta(notificacion: Notificacion): Promise<boolean> {
    const d = notificacion.aDatos();
    const { data, error } = await this.supabase
      .from("notificaciones")
      .upsert(
        {
          id: d.id,
          ocurrencia_id: d.ocurrenciaId,
          canal: d.canal,
          asunto: d.asunto,
          cuerpo: d.cuerpo,
          programada_para: d.programadaPara,
          estado: d.estado,
        },
        { onConflict: "ocurrencia_id,canal,programada_para", ignoreDuplicates: true },
      )
      .select("id");

    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async actualizar(notificacion: Notificacion): Promise<Notificacion> {
    const d = notificacion.aDatos();
    const { data, error } = await this.supabase
      .from("notificaciones")
      .update({
        estado: d.estado,
        enviada_en: d.enviadaEn,
        error: d.error,
        intentos: d.intentos,
      })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aNotificacion(data);
  }

  async cancelarDeOcurrencia(ocurrenciaId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("notificaciones")
      .update({ estado: "cancelada" })
      .eq("ocurrencia_id", ocurrenciaId)
      .in("estado", ["programada", "fallida"])
      .select("id");

    if (error) throw error;
    return (data ?? []).length;
  }
}
