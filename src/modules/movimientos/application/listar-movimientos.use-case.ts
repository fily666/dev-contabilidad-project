import type { Reloj } from "@/shared/domain/reloj";
import type {
  FiltroMovimientos,
  MovimientoRepository,
  OrdenMovimientos,
  PaginaMovimientos,
  Paginacion,
} from "../domain/movimiento.repository";

export const POR_PAGINA_POR_DEFECTO = 25;
export const POR_PAGINA_MAXIMO = 100;

/** RF-23, RF-24, RF-25. */
export class ListarMovimientos {
  constructor(
    private readonly movimientos: MovimientoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: {
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

    const pagina = await this.movimientos.listar(entrada.filtro ?? {}, orden, paginacion);
    const hoy = this.reloj.hoy();

    // RF-25: el estado que se presenta puede adelantarse al persistido. No se
    // escribe nada aqui: sincronizar la columna es tarea del cron (§10.1), y una
    // consulta de lectura no debe tener efectos.
    return {
      ...pagina,
      filas: pagina.filas.map((fila) => ({
        ...fila,
        estadoEfectivo:
          fila.estado === "pendiente" &&
          fila.fechaVencimiento !== null &&
          fila.fechaVencimiento < hoy
            ? "vencido"
            : fila.estado,
      })),
    };
  }
}
