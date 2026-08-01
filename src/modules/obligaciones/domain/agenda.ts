import type { EventoAgenda } from "./obligacion.repository";

/**
 * Cifras y agrupación de la agenda (RF-58, RF-73), definidas UNA sola vez.
 *
 * Antes cada pantalla las derivaba por su cuenta y dos de esas derivaciones se
 * contradecían **en la misma pantalla**: la tarjeta «Comprometido a 30 días»
 * sumaba solo lo que aún no había vencido, y el panel de agenda justo debajo
 * imprimía «X comprometidos» sumando todo, vencidas incluidas. Dos totales de
 * aspecto idéntico, a cuarenta píxeles uno del otro, que nunca coincidían si
 * había algo vencido — y ninguna de las dos etiquetas decía cuál era cuál.
 *
 * Aquí viven las dos cifras, con nombres que las distinguen, y ADR-11 vuelve a
 * cumplirse: la fórmula está en el dominio y las vistas la consumen.
 */

/** Corte de urgencia de RF-58; los 7 días son el aviso corto de §5.5. */
export const DIAS_SEMANA = 7;

/**
 * Las tres ventanas de RF-58. Una sola lista para las tres vistas que las usan:
 * antes cada una llevaba la suya codificada en la llamada y no coincidían.
 */
export const VENTANAS_AGENDA = [7, 30, 90] as const;

export type VentanaAgenda = (typeof VENTANAS_AGENDA)[number];

/** Ventana por omisión: la misma en todas las vistas. */
export const VENTANA_POR_OMISION: VentanaAgenda = 30;

/** Traduce el parámetro `dias` de la URL, descartando lo que no sea una ventana. */
export function leerVentana(crudo: string | string[] | undefined): VentanaAgenda {
  const valor = Number(Array.isArray(crudo) ? crudo[0] : crudo);
  return (VENTANAS_AGENDA as readonly number[]).includes(valor)
    ? (valor as VentanaAgenda)
    : VENTANA_POR_OMISION;
}

export type ClaveGrupoAgenda = "vencidas" | "semana" | "resto";

export type ResumenAgenda = {
  /** `diasRestantes < 0`. Lo que ya se pasó de fecha. */
  vencidas: number;
  importeVencido: number;
  /** Vence hoy o dentro de los próximos 7 días. */
  proximas7: number;
  importe7: number;
  /**
   * Todo lo que aún NO ha vencido dentro de la ventana consultada, los 7 días
   * incluidos. No suma lo vencido: es dinero que queda por salir, no deuda ya
   * cumplida de plazo.
   */
  porVencer: number;
  importePorVencer: number;
  /** Total de eventos de la ventana, vencidos y por vencer. */
  total: number;
  moneda: string;
};

/**
 * v1 es de moneda única (§17), pero hay que elegir una para presentar el total.
 * Se toma la del primer evento y, si no hay eventos, la que reciba quien llama
 * —normalmente la de `ajustes`—, que es el mismo criterio del resto del panel.
 */
export function resumirAgenda(
  eventos: readonly EventoAgenda[],
  monedaPorOmision: string,
): ResumenAgenda {
  const resumen: ResumenAgenda = {
    vencidas: 0,
    importeVencido: 0,
    proximas7: 0,
    importe7: 0,
    porVencer: 0,
    importePorVencer: 0,
    total: eventos.length,
    moneda: eventos[0]?.moneda ?? monedaPorOmision,
  };

  for (const evento of eventos) {
    if (evento.diasRestantes < 0) {
      resumen.vencidas += 1;
      resumen.importeVencido += evento.valorEstimado;
      continue;
    }

    resumen.porVencer += 1;
    resumen.importePorVencer += evento.valorEstimado;

    if (evento.diasRestantes <= DIAS_SEMANA) {
      resumen.proximas7 += 1;
      resumen.importe7 += evento.valorEstimado;
    }
  }

  return resumen;
}

export type GrupoAgenda = {
  clave: ClaveGrupoAgenda;
  titulo: string;
  eventos: EventoAgenda[];
  /** Subtotal del grupo. Es lo que sustituye al total único del panel. */
  total: number;
  moneda: string;
};

const TITULO: Record<ClaveGrupoAgenda, string> = {
  vencidas: "Vencidas",
  semana: "Vence esta semana",
  resto: "Más adelante",
};

function grupoDe(diasRestantes: number): ClaveGrupoAgenda {
  if (diasRestantes < 0) return "vencidas";
  return diasRestantes <= DIAS_SEMANA ? "semana" : "resto";
}

/**
 * Reparte los eventos por urgencia y da a cada grupo su propio subtotal.
 *
 * Un subtotal por grupo no puede contradecir a la tarjeta que resume el mismo
 * grupo, que es exactamente lo que hacía el total único. Los grupos vacíos no se
 * devuelven: un encabezado «Vencidas» sobre una lista vacía ocupa espacio para
 * decir que no hay nada, y eso ya lo dice su ausencia.
 */
export function agruparAgenda(
  eventos: readonly EventoAgenda[],
  monedaPorOmision: string,
): GrupoAgenda[] {
  const orden: ClaveGrupoAgenda[] = ["vencidas", "semana", "resto"];
  const porClave = new Map<ClaveGrupoAgenda, EventoAgenda[]>();

  for (const evento of eventos) {
    const clave = grupoDe(evento.diasRestantes);
    const lista = porClave.get(clave);
    if (lista) lista.push(evento);
    else porClave.set(clave, [evento]);
  }

  return orden.flatMap((clave) => {
    const propios = porClave.get(clave);
    if (!propios || propios.length === 0) return [];

    return [
      {
        clave,
        titulo: TITULO[clave],
        eventos: propios,
        total: propios.reduce((suma, e) => suma + e.valorEstimado, 0),
        moneda: propios[0]?.moneda ?? monedaPorOmision,
      },
    ];
  });
}
