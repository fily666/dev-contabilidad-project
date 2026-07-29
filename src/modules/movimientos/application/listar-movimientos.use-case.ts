import type {
  FiltroMovimientos,
  MovimientoRepository,
  OrdenMovimientos,
  PaginaMovimientos,
  Paginacion,
} from "../domain/movimiento.repository";

export const POR_PAGINA_POR_DEFECTO = 25;
export const POR_PAGINA_MAXIMO = 100;

/** RF-23, RF-24. */
export class ListarMovimientos {
  constructor(private readonly movimientos: MovimientoRepository) {}

  async ejecutar(entrada: {
    propietarioId: string;
    filtro?: FiltroMovimientos;
    orden?: Partial<OrdenMovimientos>;
    paginacion?: Partial<Paginacion>;
  }): Promise<PaginaMovimientos> {
    const orden: OrdenMovimientos = {
      campo: entrada.orden?.campo ?? "fecha",
      direccion: entrada.orden?.direccion ?? "desc",
    };

    const paginacion: Paginacion = {
      pagina: Math.max(1, entrada.paginacion?.pagina ?? 1),
      porPagina: Math.min(
        POR_PAGINA_MAXIMO,
        Math.max(1, entrada.paginacion?.porPagina ?? POR_PAGINA_POR_DEFECTO),
      ),
    };

    return this.movimientos.listar(entrada.propietarioId, entrada.filtro ?? {}, orden, paginacion);
  }
}
