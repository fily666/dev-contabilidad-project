import { NoEncontrado } from "@/shared/domain/errores";
import type { FechaIso, Reloj } from "@/shared/domain/reloj";
import { Movimiento } from "../domain/movimiento.entity";
import type { MovimientoRepository } from "../domain/movimiento.repository";

/**
 * RF-28: duplicar un movimiento como plantilla.
 *
 * La copia nace **pendiente** y con la fecha de hoy, no pagada: duplicar sirve
 * para no volver a escribir un registro parecido, y dar por pagado algo que
 * nadie pagó inflaría la caja ejecutada (regla de oro §2). El vinculo con la
 * ocurrencia no se copia: la copia no ejecuta la obligacion del original.
 */
export class DuplicarMovimiento {
  constructor(
    private readonly movimientos: MovimientoRepository,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: { id: string; fecha?: FechaIso }): Promise<Movimiento> {
    const original = await this.movimientos.buscarPorId(entrada.id);
    if (!original) throw new NoEncontrado("movimiento", entrada.id);

    const d = original.aDatos();
    const copia = Movimiento.crear({
      id: this.nuevoId(),
      proyectoId: d.proyectoId,
      categoriaId: d.categoriaId,
      naturalezaDeCategoria: d.naturaleza,
      naturaleza: d.naturaleza,
      tipo: d.tipo,
      metodoPagoId: d.metodoPagoId,
      fecha: entrada.fecha ?? this.reloj.hoy(),
      valor: d.valor,
      moneda: d.moneda,
      abonoCapital: d.abonoCapital,
      abonoInteres: d.abonoInteres,
      descripcion: d.descripcion,
      observaciones: d.observaciones,
      estado: "pendiente",
    });

    return this.movimientos.guardar(copia);
  }
}
