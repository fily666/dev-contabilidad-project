import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/infrastructure/supabase/database.types";
import {
  AJUSTES_POR_OMISION,
  CANALES_DISPONIBLES,
  FORMATOS_FECHA,
  type Ajustes,
  type AjustesRepository,
  type CanalAviso,
  type FormatoFecha,
} from "../domain/sesion";

/**
 * Claves de `ajustes.preferencias` (jsonb). Van en snake_case porque viven en la
 * base (§8.3); el mapeo a camelCase ocurre aqui, que es donde corresponde.
 */
type Preferencias = {
  formato_fecha?: unknown;
  horizonte_proyeccion_meses?: unknown;
  canales_notificacion?: unknown;
  dias_aviso_por_omision?: unknown;
  email_destino?: unknown;
  whatsapp_destino?: unknown;
};

type PreferenciasLeidas = Pick<
  Ajustes,
  | "formatoFecha"
  | "horizonteProyeccionMeses"
  | "canalesNotificacion"
  | "diasAvisoPorOmision"
  | "emailDestino"
  | "whatsappDestino"
>;

/**
 * RF-101 se guarda en `preferencias` y no en columnas propias a proposito: son
 * preferencias de presentacion, no datos del dominio, y agregar una mas no debe
 * costar una migracion. Todo valor desconocido cae al valor por omision.
 */
function leerPreferencias(crudo: unknown): PreferenciasLeidas {
  const objeto = (crudo ?? {}) as Preferencias;
  const formato = objeto.formato_fecha;
  const horizonte = objeto.horizonte_proyeccion_meses;

  const canales = Array.isArray(objeto.canales_notificacion)
    ? objeto.canales_notificacion.filter((c): c is CanalAviso =>
        (CANALES_DISPONIBLES as readonly unknown[]).includes(c),
      )
    : [];
  const dias = Array.isArray(objeto.dias_aviso_por_omision)
    ? objeto.dias_aviso_por_omision.filter(
        (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 90,
      )
    : [];
  const email = typeof objeto.email_destino === "string" ? objeto.email_destino.trim() : "";
  const whatsapp =
    typeof objeto.whatsapp_destino === "string" ? objeto.whatsapp_destino.trim() : "";

  return {
    formatoFecha: FORMATOS_FECHA.includes(formato as FormatoFecha)
      ? (formato as FormatoFecha)
      : AJUSTES_POR_OMISION.formatoFecha,
    horizonteProyeccionMeses:
      typeof horizonte === "number" && Number.isInteger(horizonte) && horizonte > 0
        ? horizonte
        : AJUSTES_POR_OMISION.horizonteProyeccionMeses,
    canalesNotificacion: canales.length > 0 ? canales : AJUSTES_POR_OMISION.canalesNotificacion,
    diasAvisoPorOmision: dias.length > 0 ? dias : AJUSTES_POR_OMISION.diasAvisoPorOmision,
    emailDestino: email.includes("@") ? email : null,
    whatsappDestino: /^\+[1-9]\d{7,14}$/.test(whatsapp) ? whatsapp : null,
  };
}

/** ADAPTADOR del puerto AjustesRepository (Contexto.md §7.3). */
export class SupabaseAjustesRepository implements AjustesRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async obtener(): Promise<Ajustes> {
    const { data, error } = await this.supabase
      .from("ajustes")
      .select("moneda, zona_horaria, preferencias")
      .maybeSingle();

    if (error) throw error;

    // Si seed.sql no ha corrido todavia, la aplicacion arranca con los valores
    // por omision en lugar de reventar: son los mismos que siembra la semilla.
    if (!data) return AJUSTES_POR_OMISION;

    return {
      moneda: data.moneda,
      zonaHoraria: data.zona_horaria,
      ...leerPreferencias(data.preferencias),
    };
  }

  async actualizar(datos: Partial<Ajustes>): Promise<Ajustes> {
    // Se leen los actuales para fusionar: un upsert con `preferencias` parcial
    // borraria las claves que no viajan en esta actualizacion.
    const actuales = await this.obtener();

    const { data, error } = await this.supabase
      .from("ajustes")
      .upsert({
        id: true,
        moneda: datos.moneda ?? actuales.moneda,
        zona_horaria: datos.zonaHoraria ?? actuales.zonaHoraria,
        preferencias: {
          formato_fecha: datos.formatoFecha ?? actuales.formatoFecha,
          horizonte_proyeccion_meses:
            datos.horizonteProyeccionMeses ?? actuales.horizonteProyeccionMeses,
          canales_notificacion: datos.canalesNotificacion ?? actuales.canalesNotificacion,
          dias_aviso_por_omision: datos.diasAvisoPorOmision ?? actuales.diasAvisoPorOmision,
          email_destino:
            datos.emailDestino === undefined ? actuales.emailDestino : datos.emailDestino,
          whatsapp_destino:
            datos.whatsappDestino === undefined ? actuales.whatsappDestino : datos.whatsappDestino,
        },
      })
      .select("moneda, zona_horaria, preferencias")
      .single();

    if (error) throw error;

    return {
      moneda: data.moneda,
      zonaHoraria: data.zona_horaria,
      ...leerPreferencias(data.preferencias),
    };
  }
}
