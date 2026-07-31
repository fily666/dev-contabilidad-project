import { MetodoPago } from "../domain/metodo-pago.entity";
import type { MetodoPagoRepository, MetodoPagoVista } from "../domain/metodo-pago.repository";

function aVista(metodo: MetodoPago): MetodoPagoVista {
  const d = metodo.aDatos();
  return {
    id: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
    ultimosDigitos: d.ultimosDigitos,
    activo: d.activo,
  };
}

/** Doble en memoria del puerto MetodoPagoRepository (Contexto.md §8.8). */
export class MetodoPagoRepositoryEnMemoria implements MetodoPagoRepository {
  readonly filas = new Map<string, MetodoPago>();
  readonly movimientosPorMetodo = new Map<string, number>();
  eliminados: string[] = [];

  constructor(iniciales: MetodoPago[] = []) {
    for (const metodo of iniciales) this.filas.set(metodo.id, metodo);
  }

  async listar(soloActivos = true): Promise<MetodoPagoVista[]> {
    return [...this.filas.values()].filter((m) => !soloActivos || m.activo).map(aVista);
  }

  async buscarPorId(id: string): Promise<MetodoPago | null> {
    return this.filas.get(id) ?? null;
  }

  async existeNombre(nombre: string, excluirId?: string): Promise<boolean> {
    return [...this.filas.values()].some(
      (m) => m.id !== excluirId && m.nombre.toLowerCase() === nombre.trim().toLowerCase(),
    );
  }

  async guardar(metodo: MetodoPago): Promise<MetodoPagoVista> {
    this.filas.set(metodo.id, metodo);
    return aVista(metodo);
  }

  async actualizar(metodo: MetodoPago): Promise<MetodoPagoVista> {
    this.filas.set(metodo.id, metodo);
    return aVista(metodo);
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    this.eliminados.push(id);
  }

  async contarMovimientos(id: string): Promise<number> {
    return this.movimientosPorMetodo.get(id) ?? 0;
  }
}

export const ID_TRANSFERENCIA = "33333333-3333-4333-8333-333333333333";

/**
 * Fabrica, no constante: las entidades son mutables y una instancia compartida
 * entre pruebas arrastraba el renombrado de una a la siguiente.
 */
export function metodoTransferencia(): MetodoPago {
  return MetodoPago.crear({
    id: ID_TRANSFERENCIA,
    nombre: "Transferencia",
    tipo: "transferencia",
  });
}
