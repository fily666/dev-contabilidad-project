import type { Reloj } from "@/shared/domain/reloj";
import type { TipoMovimiento } from "@/shared/domain/enumeraciones";
import type { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";
import type { ObligacionRepository } from "@/modules/obligaciones/domain/obligacion.repository";

import {
  claveDeMes,
  construirMes,
  primerDiaDelMes,
  resumirMes,
  ultimoDiaDelMes,
  type ClaveMes,
  type DiaCalendario,
  type EventoCalendario,
  type ResumenMes,
} from "../domain/mes";

export type FiltroCalendario = {
  mes?: ClaveMes;
  proyectoId?: string;
  /** RF-62: ver solo ingresos o solo egresos. */
  tipo?: TipoMovimiento;
};

export type Calendario = {
  mes: ClaveMes;
  dias: DiaCalendario[];
  comprometido: number;
  moneda: string;
  totalEventos: number;
  /** Cifras del mes de §5.2, calculadas en el dominio (ADR-11). */
  resumen: ResumenMes;
};

/**
 * RF-60 a RF-63: vista mensual con las ocurrencias y los movimientos en su fecha.
 *
 * Se toman los movimientos por su fecha de vencimiento cuando la tienen, porque
 * en el calendario lo que importa es el dia en que hay que pagar, no el dia en
 * que se registro el compromiso.
 */
export class ObtenerCalendario {
  constructor(
    /**
     * Se inyecta el caso de uso y no el repositorio: `estadoEfectivo` (RF-25) se
     * calcula alli, y el calendario tiene que pintar en rojo lo vencido aunque
     * el cron todavia no haya actualizado la columna.
     */
    private readonly listarMovimientos: ListarMovimientos,
    private readonly obligaciones: ObligacionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { filtro?: FiltroCalendario } = {}): Promise<Calendario> {
    const hoy = this.reloj.hoy();
    const mes = entrada.filtro?.mes ?? claveDeMes(hoy);
    const desde = primerDiaDelMes(mes);
    const hasta = ultimoDiaDelMes(mes);

    const [pagina, agenda] = await Promise.all([
      this.listarMovimientos.ejecutar({
        filtro: {
          proyectoId: entrada.filtro?.proyectoId,
          desde,
          hasta,
          tipos: entrada.filtro?.tipo ? [entrada.filtro.tipo] : undefined,
        },
        orden: { campo: "fecha", direccion: "asc" },
        // El mes de un solo dueño no llega a 100 movimientos; si algun dia
        // llegara, la rejilla ya no seria la vista adecuada.
        paginacion: { pagina: 1, porPagina: 100 },
      }),
      // Las ocurrencias son siempre egresos comprometidos: si el filtro pide
      // solo ingresos, no aplican.
      entrada.filtro?.tipo === "ingreso"
        ? Promise.resolve([])
        : this.obligaciones.listarAgenda({
            proyectoId: entrada.filtro?.proyectoId,
            desde,
            hasta,
            incluirVencidas: true,
          }),
    ]);

    const eventos: EventoCalendario[] = [
      ...pagina.filas
        .filter((fila) => fila.estado !== "anulado")
        .map((fila) => ({
          id: `movimiento-${fila.id}`,
          // La fecha de vencimiento manda si existe: es el dia que interesa.
          fecha: fila.fechaVencimiento ?? fila.fecha,
          clase: "movimiento" as const,
          concepto: fila.descripcion,
          proyectoId: fila.proyectoId,
          proyectoNombre: fila.proyectoNombre,
          valor: fila.valor,
          moneda: fila.moneda,
          tipo: fila.tipo,
          estado: fila.estadoEfectivo,
          movimientoId: fila.id,
        })),
      ...agenda.map((evento) => ({
        id: `ocurrencia-${evento.ocurrenciaId}`,
        fecha: evento.fechaVencimiento,
        clase: "ocurrencia" as const,
        concepto: evento.concepto,
        proyectoId: evento.proyectoId,
        proyectoNombre: evento.proyectoNombre,
        valor: evento.valorEstimado,
        moneda: evento.moneda,
        tipo: "egreso" as const,
        estado: evento.estado,
        ocurrenciaId: evento.ocurrenciaId,
      })),
    ];

    // Un movimiento creado al pagar una ocurrencia apunta a ella; la ocurrencia
    // ya salio de la agenda al quedar pagada, asi que no hay doble conteo.
    const dias = construirMes({ mes, hoy, eventos });
    const resumen = resumirMes(dias);

    return {
      mes,
      dias,
      comprometido: resumen.comprometido,
      moneda: eventos[0]?.moneda ?? "COP",
      totalEventos: eventos.length,
      resumen,
    };
  }
}
