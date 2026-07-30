import type { TipoMetodoPago } from "@/shared/domain/enumeraciones";

/** PUERTO (Contexto.md §7.3). RF-33. */

export type MetodoPago = {
  id: string;
  nombre: string;
  tipo: TipoMetodoPago;
  ultimosDigitos: string | null;
  activo: boolean;
};

export type EntradaMetodoPago = {
  nombre: string;
  tipo: TipoMetodoPago;
  ultimosDigitos?: string | null;
};

export interface MetodoPagoRepository {
  listar(soloActivos?: boolean): Promise<MetodoPago[]>;
  buscarPorId(id: string): Promise<MetodoPago | null>;
  crear(entrada: EntradaMetodoPago): Promise<MetodoPago>;
  actualizar(id: string, entrada: EntradaMetodoPago & { activo?: boolean }): Promise<MetodoPago>;
  eliminar(id: string): Promise<void>;
  contarMovimientos(id: string): Promise<number>;
}
