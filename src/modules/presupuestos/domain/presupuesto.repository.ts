import type { Naturaleza } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Presupuesto } from "./presupuesto.entity";

/** PUERTO `PresupuestoRepository` (Contexto.md §7.3). */

export type FiltroPresupuestos = {
  proyectoId?: string;
  /** Presupuestos cuyo periodo intersecta el rango. */
  desde?: FechaIso;
  hasta?: FechaIso;
  /** Solo los del periodo que contiene esta fecha. */
  vigenteEn?: FechaIso;
};

/** Fila de `v_presupuesto_ejecucion` (RF-81). */
export type EjecucionPresupuesto = {
  presupuestoId: string;
  proyectoId: string | null;
  proyecto: string | null;
  categoriaId: string;
  categoria: string;
  naturaleza: Naturaleza;
  periodoInicio: FechaIso;
  periodoFin: FechaIso;
  valorPlaneado: number;
  valorReal: number;
  desviacion: number;
  /** Tanto por uno; `null` si el planeado es cero (guarda §5.3). */
  ejecucion: number | null;
  movimientos: number;
  moneda: string;
};

export interface PresupuestoRepository {
  buscarPorId(id: string): Promise<Presupuesto | null>;
  /** RF-81: se lee de la vista, que ya calcula real y desviacion (ADR-11). */
  listarEjecucion(filtro?: FiltroPresupuestos): Promise<EjecucionPresupuesto[]>;
  guardar(presupuesto: Presupuesto): Promise<Presupuesto>;
  actualizar(presupuesto: Presupuesto): Promise<Presupuesto>;
  eliminar(id: string): Promise<void>;
  /** RF-83: los del periodo que se quiere copiar. */
  listarDePeriodo(entrada: {
    proyectoId?: string | null;
    periodoInicio: FechaIso;
    periodoFin: FechaIso;
  }): Promise<Presupuesto[]>;
  existeEnPeriodo(entrada: {
    proyectoId: string | null;
    categoriaId: string;
    periodoInicio: FechaIso;
    periodoFin: FechaIso;
  }): Promise<boolean>;
}
