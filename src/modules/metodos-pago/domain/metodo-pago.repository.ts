import type { TipoMetodoPago } from "@/shared/domain/enumeraciones";
import type { MetodoPago } from "./metodo-pago.entity";

/** PUERTO (Contexto.md §7.3). RF-33. */

/**
 * Proyeccion de lectura del catalogo. Es un objeto plano a proposito: viaja del
 * Server Component al Client Component, y una instancia de entidad no cruza esa
 * frontera de serializacion.
 */
export type MetodoPagoVista = {
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
  listar(soloActivos?: boolean): Promise<MetodoPagoVista[]>;
  buscarPorId(id: string): Promise<MetodoPago | null>;
  existeNombre(nombre: string, excluirId?: string): Promise<boolean>;
  guardar(metodo: MetodoPago): Promise<MetodoPagoVista>;
  actualizar(metodo: MetodoPago): Promise<MetodoPagoVista>;
  eliminar(id: string): Promise<void>;
  contarMovimientos(id: string): Promise<number>;
}
