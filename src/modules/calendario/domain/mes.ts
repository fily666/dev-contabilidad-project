import type {
  EstadoMovimiento,
  EstadoOcurrencia,
  TipoMovimiento,
} from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";

/**
 * Rejilla del calendario financiero (Contexto.md RF-60 a RF-64).
 *
 * El mes se construye en el dominio y no en el componente: la semana empieza en
 * lunes (es-CO), y esa decision debe ser verificable con una prueba en lugar de
 * quedar escondida en un `map` de JSX.
 */

export type ClaveMes = string; // `yyyy-MM`

export type EventoCalendario = {
  id: string;
  fecha: FechaIso;
  clase: "movimiento" | "ocurrencia";
  concepto: string;
  proyectoId: string;
  proyectoNombre: string;
  valor: number;
  moneda: string;
  tipo: TipoMovimiento;
  /** Estado ya efectivo: un pendiente con fecha pasada llega como vencido. */
  estado: EstadoMovimiento | EstadoOcurrencia;
  /** Solo en ocurrencias: permite registrar el pago (RF-64). */
  ocurrenciaId?: string;
  /** Solo en movimientos: permite marcar pagado (RF-64). */
  movimientoId?: string;
};

export type DiaCalendario = {
  fecha: FechaIso;
  /** false para los dias de relleno del mes anterior o siguiente. */
  delMes: boolean;
  esHoy: boolean;
  eventos: EventoCalendario[];
  /** Suma de lo pendiente del dia: lo que hay que tener disponible. */
  comprometido: number;
};

export function claveDeMes(fecha: FechaIso): ClaveMes {
  return fecha.slice(0, 7);
}

export function primerDiaDelMes(mes: ClaveMes): FechaIso {
  return `${mes}-01`;
}

export function ultimoDiaDelMes(mes: ClaveMes): FechaIso {
  const [anio, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10);
}

export function mesAnterior(mes: ClaveMes): ClaveMes {
  const [anio, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(anio, m - 2, 1)).toISOString().slice(0, 7);
}

export function mesSiguiente(mes: ClaveMes): ClaveMes {
  const [anio, m] = mes.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(anio, m, 1)).toISOString().slice(0, 7);
}

export function esClaveDeMes(valor: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

/** Estados que representan dinero aun no ejecutado (§5.2). */
function esComprometido(estado: EventoCalendario["estado"]): boolean {
  return estado === "pendiente" || estado === "vencido" || estado === "vencida";
}

/**
 * Rejilla completa de seis semanas como maximo, con relleno para que el mes
 * siempre empiece en lunes y termine en domingo.
 */
export function construirMes(entrada: {
  mes: ClaveMes;
  hoy: FechaIso;
  eventos: readonly EventoCalendario[];
}): DiaCalendario[] {
  const [anio, m] = entrada.mes.split("-").map(Number) as [number, number];
  const primero = new Date(Date.UTC(anio, m - 1, 1));

  // getUTCDay(): 0 = domingo. Con lunes como primer dia, el desplazamiento del
  // domingo es 6 y no 0.
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setUTCDate(inicio.getUTCDate() - desplazamiento);

  const ultimo = new Date(Date.UTC(anio, m, 0));
  const totalCeldas = Math.ceil((desplazamiento + ultimo.getUTCDate()) / 7) * 7;

  const porFecha = new Map<FechaIso, EventoCalendario[]>();
  for (const evento of entrada.eventos) {
    const lista = porFecha.get(evento.fecha) ?? [];
    lista.push(evento);
    porFecha.set(evento.fecha, lista);
  }

  const dias: DiaCalendario[] = [];
  for (let i = 0; i < totalCeldas; i += 1) {
    const dia = new Date(inicio);
    dia.setUTCDate(dia.getUTCDate() + i);
    const fecha = dia.toISOString().slice(0, 10);
    const eventos = (porFecha.get(fecha) ?? []).sort(
      (a, b) => b.valor - a.valor || a.concepto.localeCompare(b.concepto),
    );

    dias.push({
      fecha,
      delMes: fecha.slice(0, 7) === entrada.mes,
      esHoy: fecha === entrada.hoy,
      eventos,
      comprometido: eventos
        .filter((e) => esComprometido(e.estado))
        .reduce((suma, e) => suma + e.valor, 0),
    });
  }

  return dias;
}

/** RF-63: total comprometido del mes, para el encabezado. */
export function comprometidoDelMes(dias: readonly DiaCalendario[]): number {
  return dias.filter((d) => d.delMes).reduce((suma, d) => suma + d.comprometido, 0);
}

export type ResumenMes = {
  /** RF-63: pendiente y vencido del mes, lo que hay que tener disponible. */
  comprometido: number;
  /** Eventos del mes, sin contar el relleno de las semanas de los extremos. */
  eventos: number;
  /** Cuántos de esos eventos ya pasaron de fecha sin pagarse. */
  vencidos: number;
  importeVencido: number;
  /** Lo ya ejecutado dentro del mes: el contrapeso de lo comprometido. */
  pagado: number;
};

/**
 * Las cifras del mes, definidas en el dominio y no en la página (ADR-11).
 *
 * La vista tenía una sola: el comprometido. Lo vencido del mes se pintaba celda a
 * celda en rojo y no se sumaba en ninguna parte, así que para saber cuánto había
 * que recorrer la rejilla contando cuadros —y la rejilla es de seis semanas—.
 * `comprometido` incluye lo vencido a propósito (es dinero que sigue sin salir),
 * por eso lo vencido se publica aparte en lugar de sumarse dos veces.
 */
export function resumirMes(dias: readonly DiaCalendario[]): ResumenMes {
  const resumen: ResumenMes = {
    comprometido: 0,
    eventos: 0,
    vencidos: 0,
    importeVencido: 0,
    pagado: 0,
  };

  for (const dia of dias) {
    if (!dia.delMes) continue;

    resumen.comprometido += dia.comprometido;
    resumen.eventos += dia.eventos.length;

    for (const evento of dia.eventos) {
      if (evento.estado === "vencido" || evento.estado === "vencida") {
        resumen.vencidos += 1;
        resumen.importeVencido += evento.valor;
      } else if (evento.estado === "pagado" || evento.estado === "pagada") {
        resumen.pagado += evento.valor;
      }
    }
  }

  return resumen;
}

export const NOMBRES_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
