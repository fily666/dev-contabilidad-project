import type { EstadoOcurrencia, Frecuencia } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Obligacion } from "./obligacion.entity";
import type { Ocurrencia } from "./ocurrencia.entity";

/** PUERTO (Contexto.md §7.3): obligaciones y sus ocurrencias. */

export type FiltroObligaciones = {
  proyectoId?: string;
  soloActivas?: boolean;
  texto?: string;
};

/** Fila lista para la tabla, con los nombres ya resueltos. */
export type ObligacionListada = {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  categoriaId: string;
  categoria: string;
  concepto: string;
  valorEstimado: number;
  moneda: string;
  fechaVencimiento: FechaIso;
  frecuencia: Frecuencia;
  intervaloMeses: number | null;
  diasAviso: number[];
  activa: boolean;
  /** Proxima ocurrencia pendiente o vencida, si hay alguna. */
  proximoVencimiento: FechaIso | null;
  ocurrenciasPendientes: number;
  ocurrenciasVencidas: number;
};

/** Evento de la agenda (RF-58, RF-73), proyeccion de `v_agenda_obligaciones`. */
export type EventoAgenda = {
  ocurrenciaId: string;
  obligacionId: string;
  proyectoId: string;
  proyectoNombre: string;
  concepto: string;
  categoriaId: string;
  fechaVencimiento: FechaIso;
  valorEstimado: number;
  moneda: string;
  estado: EstadoOcurrencia;
  diasRestantes: number;
  movimientoId: string | null;
};

export type FiltroAgenda = {
  proyectoId?: string;
  /** Ventana en dias hacia adelante: 7, 30 o 90 (RF-58). */
  dentroDeDias?: number;
  incluirVencidas?: boolean;
  estados?: EstadoOcurrencia[];
  desde?: FechaIso;
  hasta?: FechaIso;
};

export type OcurrenciaListada = {
  id: string;
  fechaVencimiento: FechaIso;
  valorEstimado: number;
  estado: EstadoOcurrencia;
  movimientoId: string | null;
};

export interface ObligacionRepository {
  buscarPorId(id: string): Promise<Obligacion | null>;
  listar(filtro?: FiltroObligaciones): Promise<ObligacionListada[]>;
  guardar(obligacion: Obligacion): Promise<Obligacion>;
  actualizar(obligacion: Obligacion): Promise<Obligacion>;
  /** Solo si no tiene ocurrencias pagadas: la trazabilidad manda (ADR-12). */
  eliminar(id: string): Promise<void>;
  contarOcurrenciasPagadas(obligacionId: string): Promise<number>;

  buscarOcurrencia(id: string): Promise<Ocurrencia | null>;
  actualizarOcurrencia(ocurrencia: Ocurrencia): Promise<Ocurrencia>;
  listarOcurrencias(obligacionId: string): Promise<OcurrenciaListada[]>;
  listarAgenda(filtro?: FiltroAgenda): Promise<EventoAgenda[]>;

  /**
   * Materializa las ocurrencias faltantes del horizonte (RF-52, §10.1).
   * Es idempotente por el indice unico de §6.3; devuelve cuantas insertó.
   */
  generarOcurrencias(horizonteMeses: number): Promise<number>;
  /** Pasa a `vencido`/`vencida` lo pendiente con fecha anterior a hoy (§10.1). */
  marcarVencidos(): Promise<number>;
}
