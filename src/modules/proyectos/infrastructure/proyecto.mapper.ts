import type { Json, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Proyecto, type DatosProyecto } from "../domain/proyecto.entity";
import { leerConfiguracion, TipoProyecto } from "../domain/tipo-proyecto.entity";
import type { ValorAtributo } from "../domain/tipo-proyecto.entity";

type FilaProyecto = Tablas<"proyectos">;
type FilaTipoProyecto = Tablas<"tipos_proyecto">;

export function aProyecto(fila: FilaProyecto): Proyecto {
  const datos: DatosProyecto = {
    id: fila.id,
    tipoProyectoId: fila.tipo_proyecto_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    estado: fila.estado,
    moneda: fila.moneda,
    atributos: (fila.atributos ?? {}) as Record<string, ValorAtributo>,
  };
  return Proyecto.desdePersistencia(datos);
}

export function aFilaProyecto(proyecto: Proyecto) {
  const d = proyecto.aDatos();
  return {
    id: d.id,
    tipo_proyecto_id: d.tipoProyectoId,
    nombre: d.nombre,
    descripcion: d.descripcion,
    fecha_inicio: d.fechaInicio,
    fecha_fin: d.fechaFin,
    estado: d.estado,
    moneda: d.moneda,
    atributos: d.atributos,
  };
}

export function aTipoProyecto(fila: FilaTipoProyecto): TipoProyecto {
  return new TipoProyecto(
    fila.id,
    fila.codigo,
    fila.nombre,
    fila.icono,
    leerConfiguracion(fila.configuracion),
    fila.es_sistema,
    fila.activo,
  );
}

/** RF-100: la configuracion viaja como JSONB con las claves del esquema (§13). */
export function aFilaTipoProyecto(tipo: TipoProyecto) {
  return {
    id: tipo.id,
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    icono: tipo.icono,
    es_sistema: tipo.esSistema,
    activo: tipo.activo,
    // El JSONB se arma con las claves del esquema, no con las del dominio.
    configuracion: {
      atributos: tipo.configuracion.atributos.map((a) => ({ ...a })),
      indicadores: [...tipo.configuracion.indicadores],
      genera_ingresos: tipo.configuracion.generaIngresos,
      se_valoriza: tipo.configuracion.seValoriza,
    } as unknown as Json,
  };
}
