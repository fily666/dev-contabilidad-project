/**
 * Puerto de tiempo. Contexto.md §7.3.
 *
 * El dominio nunca llama a `new Date()` directamente: al inyectar el reloj,
 * los vencimientos y las recurrencias son verificables en pruebas.
 */
export interface Reloj {
  /** Instante actual. */
  ahora(): Date;
  /** Fecha de negocio de hoy en formato ISO `yyyy-MM-dd` (§8.5). */
  hoy(): FechaIso;
}

/** Fecha de negocio sin hora, en formato `yyyy-MM-dd` (§8.5). */
export type FechaIso = string;

export function esFechaIso(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

export function aFechaIso(fecha: Date): FechaIso {
  return fecha.toISOString().slice(0, 10);
}

/** Diferencia en dias completos entre dos fechas de negocio. */
export function diasEntre(desde: FechaIso, hasta: FechaIso): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Meses completos transcurridos entre dos fechas de negocio. */
export function mesesEntre(desde: FechaIso, hasta: FechaIso): number {
  const [a1, m1, d1] = desde.split("-").map(Number) as [number, number, number];
  const [a2, m2, d2] = hasta.split("-").map(Number) as [number, number, number];
  const meses = (a2 - a1) * 12 + (m2 - m1);
  return d2 < d1 ? meses - 1 : meses;
}
