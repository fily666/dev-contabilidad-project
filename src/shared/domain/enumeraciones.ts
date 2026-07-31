/**
 * Vocabulario compartido del dominio (Contexto.md §2 y §6.2).
 * Los valores coinciden exactamente con los tipos enumerados de PostgreSQL.
 */

export const ESTADOS_PROYECTO = ["activo", "pausado", "finalizado", "archivado"] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export const TIPOS_MOVIMIENTO = ["ingreso", "egreso"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/**
 * Naturaleza economica. Es la distincion central del sistema:
 * - `capex`        inversion que capitaliza (suma al total invertido)
 * - `opex`         gasto operativo de sostenimiento
 * - `financiacion` deuda: desembolsos y cuotas de credito
 * - `ingreso`      entrada generada por el proyecto
 */
export const NATURALEZAS = ["capex", "opex", "ingreso", "financiacion"] as const;
export type Naturaleza = (typeof NATURALEZAS)[number];

export const ESTADOS_MOVIMIENTO = ["pendiente", "pagado", "vencido", "anulado"] as const;
export type EstadoMovimiento = (typeof ESTADOS_MOVIMIENTO)[number];

export const FRECUENCIAS = [
  "unica",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
  "personalizada",
] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const ESTADOS_OCURRENCIA = ["pendiente", "pagada", "vencida", "omitida"] as const;
export type EstadoOcurrencia = (typeof ESTADOS_OCURRENCIA)[number];

export const TIPOS_DOCUMENTO = [
  "factura",
  "recibo",
  "comprobante",
  "contrato",
  "escritura",
  "fotografia",
  "poliza",
  "otro",
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const TIPOS_METODO_PAGO = [
  "efectivo",
  "transferencia",
  "tarjeta_credito",
  "tarjeta_debito",
  "debito_automatico",
  "otro",
] as const;
export type TipoMetodoPago = (typeof TIPOS_METODO_PAGO)[number];

/** Naturalezas admitidas por cada tipo de movimiento (invariante §5.7.3). */
export const NATURALEZAS_POR_TIPO: Record<TipoMovimiento, readonly Naturaleza[]> = {
  ingreso: ["ingreso", "financiacion"],
  egreso: ["capex", "opex", "financiacion"],
};

export function naturalezaEsCompatible(tipo: TipoMovimiento, naturaleza: Naturaleza): boolean {
  return NATURALEZAS_POR_TIPO[tipo].includes(naturaleza);
}
