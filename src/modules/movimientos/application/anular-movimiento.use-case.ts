import { NoEncontrado } from "@/shared/domain/errores";
import type { Movimiento } from "../domain/movimiento.entity";
import type { MovimientoRepository } from "../domain/movimiento.repository";

/**
 * RF-22: nunca hay borrado fisico de movimientos (ADR-12).
 * La anulacion conserva el registro y lo excluye de todas las cifras.
 */
export class AnularMovimiento {
  constructor(private readonly movimientos: MovimientoRepository) {}

  async ejecutar(entrada: {
    id: string;
    propietarioId: string;
    motivo: string;
  }): Promise<Movimiento> {
    const movimiento = await this.movimientos.buscarPorId(entrada.id, entrada.propietarioId);
    if (!movimiento) throw new NoEncontrado("movimiento", entrada.id);

    movimiento.anular(entrada.motivo);
    return this.movimientos.actualizar(movimiento, entrada.propietarioId);
  }
}
