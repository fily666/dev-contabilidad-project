import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Naturaleza, TipoMovimiento } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { CategoriaRepository } from "@/modules/categorias/domain/categoria.repository";
import type { Movimiento } from "../domain/movimiento.entity";
import type { MovimientoRepository } from "../domain/movimiento.repository";

export type EntradaActualizarMovimiento = {
  id: string;
  categoriaId: string;
  metodoPagoId?: string | null;
  tipo: TipoMovimiento;
  naturaleza?: Naturaleza;
  fecha: FechaIso;
  fechaVencimiento?: FechaIso | null;
  valor: number;
  descripcion: string;
  observaciones?: string | null;
  abonoCapital?: number | null;
  abonoInteres?: number | null;
};

/** RF-22. */
export class ActualizarMovimiento {
  constructor(
    private readonly movimientos: MovimientoRepository,
    private readonly categorias: CategoriaRepository,
  ) {}

  async ejecutar(entrada: EntradaActualizarMovimiento): Promise<Movimiento> {
    const movimiento = await this.movimientos.buscarPorId(entrada.id);
    if (!movimiento) throw new NoEncontrado("movimiento", entrada.id);

    const categoria = await this.categorias.buscarPorId(entrada.categoriaId);
    if (!categoria) throw new NoEncontrado("categoria", entrada.categoriaId);

    if (!categoria.admiteTipo(entrada.tipo)) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_INCOMPATIBLE",
        `La categoria «${categoria.nombre}» no aplica a un ${entrada.tipo}.`,
        "categoriaId",
      );
    }

    movimiento.actualizar({
      categoriaId: categoria.id,
      naturalezaDeCategoria: categoria.naturaleza,
      naturaleza: entrada.naturaleza,
      tipo: entrada.tipo,
      metodoPagoId: entrada.metodoPagoId,
      fecha: entrada.fecha,
      fechaVencimiento: entrada.fechaVencimiento,
      valor: entrada.valor,
      descripcion: entrada.descripcion,
      observaciones: entrada.observaciones,
      abonoCapital: entrada.abonoCapital,
      abonoInteres: entrada.abonoInteres,
    });

    return this.movimientos.actualizar(movimiento);
  }
}
