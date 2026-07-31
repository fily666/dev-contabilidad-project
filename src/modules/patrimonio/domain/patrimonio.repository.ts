import type { EstadoProyecto } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Pasivo, TipoPasivo } from "./pasivo.entity";
import type { Valoracion } from "./valoracion.entity";

/** PUERTOS `PasivoRepository` y `ValoracionRepository` (Contexto.md §7.3). */

export type PasivoListado = {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  nombre: string;
  tipo: TipoPasivo;
  montoOriginal: number;
  saldoActual: number;
  tasaInteresEa: number | null;
  plazoMeses: number | null;
  valorCuota: number | null;
  fechaDesembolso: FechaIso;
  activo: boolean;
  moneda: string;
  /** Tanto por uno ya pagado; `null` si no es calculable. */
  amortizado: number | null;
};

export type ValoracionListada = {
  id: string;
  proyectoId: string;
  fecha: FechaIso;
  valor: number;
  fuente: string | null;
  notas: string | null;
  moneda: string;
};

/** RF-78: fila de `v_patrimonio_proyecto`. */
export type PatrimonioProyecto = {
  proyectoId: string;
  proyecto: string;
  estado: EstadoProyecto;
  moneda: string;
  valoracionActual: number | null;
  valoracionFecha: FechaIso | null;
  pasivoTotal: number;
  patrimonioNeto: number;
  /** Capex pagado, para el retorno sobre lo invertido. */
  totalInvertido: number;
  totalIngresos: number;
  totalEgresos: number;
};

export interface PasivoRepository {
  buscarPorId(id: string): Promise<Pasivo | null>;
  listar(filtro?: { proyectoId?: string; soloActivos?: boolean }): Promise<PasivoListado[]>;
  guardar(pasivo: Pasivo): Promise<Pasivo>;
  actualizar(pasivo: Pasivo): Promise<Pasivo>;
  eliminar(id: string): Promise<void>;
}

export interface ValoracionRepository {
  buscarPorId(id: string): Promise<Valoracion | null>;
  listar(filtro?: { proyectoId?: string }): Promise<ValoracionListada[]>;
  guardar(valoracion: Valoracion): Promise<Valoracion>;
  eliminar(id: string): Promise<void>;
  /** RF-78: patrimonio por proyecto, leido de la vista de §6.4. */
  patrimonio(filtro?: { proyectoId?: string }): Promise<PatrimonioProyecto[]>;
}
