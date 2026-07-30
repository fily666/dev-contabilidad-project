import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/infrastructure/supabase/database.types";
import {
  AJUSTES_POR_OMISION,
  FORMATOS_FECHA,
  type Ajustes,
  type AjustesRepository,
  type FormatoFecha,
} from "../domain/sesion";

/**
 * Claves de `ajustes.preferencias` (jsonb). Van en snake_case porque viven en la
 * base (§8.3); el mapeo a camelCase ocurre aqui, que es donde corresponde.
 */
type Preferencias = {
  formato_fecha?: unknown;
  horizonte_proyeccion_meses?: unknown;
};

type PreferenciasLeidas = Pick<Ajustes, "formatoFecha" | "horizonteProyeccionMeses">;

/**
 * RF-101 se guarda en `preferencias` y no en columnas propias a proposito: son
 * preferencias de presentacion, no datos del dominio, y agregar una mas no debe
 * costar una migracion. Todo valor desconocido cae al valor por omision.
 */
function leerPreferencias(crudo: unknown): PreferenciasLeidas {
  const objeto = (crudo ?? {}) as Preferencias;
  const formato = objeto.formato_fecha;
  const horizonte = objeto.horizonte_proyeccion_meses;

  return {
    formatoFecha: FORMATOS_FECHA.includes(formato as FormatoFecha)
      ? (formato as FormatoFecha)
      : AJUSTES_POR_OMISION.formatoFecha,
    horizonteProyeccionMeses:
      typeof horizonte === "number" && Number.isInteger(horizonte) && horizonte > 0
        ? horizonte
        : AJUSTES_POR_OMISION.horizonteProyeccionMeses,
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
