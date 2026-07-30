import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Naturaleza, TipoMovimiento } from "@/shared/domain/enumeraciones";
import type { FechaIso, Reloj } from "@/shared/domain/reloj";
import type { CategoriaRepository } from "@/modules/categorias/domain/categoria.repository";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";
import { Movimiento } from "../domain/movimiento.entity";
import type { MovimientoRepository } from "../domain/movimiento.repository";

export type EntradaRegistrarMovimiento = {
  proyectoId: string;
  categoriaId: string;
  metodoPagoId?: string | null;
  tipo: TipoMovimiento;
  /** RF-21: si se omite, se hereda de la categoria. */
  naturaleza?: Naturaleza;
  fecha?: FechaIso;
  fechaVencimiento?: FechaIso | null;
  fechaPago?: FechaIso | null;
  valor: number;
  descripcion: string;
  observaciones?: string | null;
  abonoCapital?: number | null;
  abonoInteres?: number | null;
  estado?: "pendiente" | "pagado";
  ocurrenciaId?: string | null;
};

/** RF-20, RF-21, RF-26. */
export class RegistrarMovimiento {
  constructor(
    private readonly movimientos: MovimientoRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaRegistrarMovimiento): Promise<Movimiento> {
    const proyecto = await this.proyectos.buscarPorId(entrada.proyectoId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.proyectoId);

    // Invariante §5.7.7.
    if (!proyecto.aceptaMovimientos()) {
      throw new ReglaDeNegocioViolada(
        "PROYECTO_CERRADO",
        "El proyecto esta finalizado o archivado y no acepta movimientos nuevos.",
      );
    }

    const categoria = await this.categorias.buscarPorId(entrada.categoriaId);
    if (!categoria) throw new NoEncontrado("categoria", entrada.categoriaId);

    // Invariante §5.7.3.
    if (!categoria.admiteTipo(entrada.tipo)) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_INCOMPATIBLE",
        `La categoria «${categoria.nombre}» no aplica a un ${entrada.tipo}.`,
        "categoriaId",
      );
    }

    const movimiento = Movimiento.crear({
      id: this.nuevoId(),
      proyectoId: proyecto.id,
      categoriaId: categoria.id,
      naturalezaDeCategoria: categoria.naturaleza,
      naturaleza: entrada.naturaleza,
      tipo: entrada.tipo,
      metodoPagoId: entrada.metodoPagoId,
      fecha: entrada.fecha ?? this.reloj.hoy(),
      fechaVencimiento: entrada.fechaVencimiento,
      fechaPago: entrada.fechaPago,
      // Invariante §5.7.5: la moneda es la del proyecto.
      moneda: proyecto.moneda,
      valor: entrada.valor,
      abonoCapital: entrada.abonoCapital,
      abonoInteres: entrada.abonoInteres,
      descripcion: entrada.descripcion,
      observaciones: entrada.observaciones,
      estado: entrada.estado,
      ocurrenciaId: entrada.ocurrenciaId,
    });

    return this.movimientos.guardar(movimiento);
  }
}
