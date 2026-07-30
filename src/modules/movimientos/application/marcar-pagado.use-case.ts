import { NoEncontrado } from "@/shared/domain/errores";
import type { FechaIso, Reloj } from "@/shared/domain/reloj";
import type { MetodoPagoRepository } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import type { Movimiento } from "../domain/movimiento.entity";
import type { MovimientoRepository } from "../domain/movimiento.repository";

/** RF-26: registrar el pago con fecha y metodo. */
export class MarcarMovimientoPagado {
  constructor(
    private readonly movimientos: MovimientoRepository,
    private readonly metodosPago: MetodoPagoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: {
    id: string;
    fechaPago?: FechaIso;
    metodoPagoId: string;
  }): Promise<Movimiento> {
    const movimiento = await this.movimientos.buscarPorId(entrada.id);
    if (!movimiento) throw new NoEncontrado("movimiento", entrada.id);

    const metodo = await this.metodosPago.buscarPorId(entrada.metodoPagoId);
    if (!metodo) throw new NoEncontrado("metodo de pago", entrada.metodoPagoId);

    movimiento.marcarPagado({
      fechaPago: entrada.fechaPago ?? this.reloj.hoy(),
      metodoPagoId: metodo.id,
    });

    return this.movimientos.actualizar(movimiento);
  }
}
