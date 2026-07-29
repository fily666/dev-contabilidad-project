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
  listar(propietarioId: string, soloActivos?: boolean): Promise<MetodoPago[]>;
  buscarPorId(id: string, propietarioId: string): Promise<MetodoPago | null>;
  crear(propietarioId: string, entrada: EntradaMetodoPago): Promise<MetodoPago>;
  actualizar(
    id: string,
    propietarioId: string,
    entrada: EntradaMetodoPago & { activo?: boolean },
  ): Promise<MetodoPago>;
  eliminar(id: string, propietarioId: string): Promise<void>;
  contarMovimientos(id: string, propietarioId: string): Promise<number>;
}
