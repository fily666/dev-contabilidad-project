import type { Frecuencia } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";

/**
 * Reglas de recurrencia de Contexto.md §5.6, RF-51 y RF-52.
 *
 * Son las mismas que implementan `meses_por_frecuencia` y
 * `siguiente_vencimiento` en la base ([§6.6](#66-triggers)). Existen aqui porque
 * la generacion de ocurrencias la ejecuta la tarea diaria en SQL, pero la
 * proyeccion a futuro y la vista previa del formulario las necesita el dominio,
 * y dos implementaciones que no se puedan comparar acaban divergiendo. Las
 * pruebas de esquema verifican la version SQL; estas, la de TypeScript, con los
 * mismos casos limite.
 */

const MESES_POR_FRECUENCIA: Record<Frecuencia, number> = {
  unica: 0,
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
  personalizada: 0,
};

export function mesesPorFrecuencia(frecuencia: Frecuencia, intervaloMeses?: number | null): number {
  if (frecuencia === "personalizada") return intervaloMeses ?? 1;
  return MESES_POR_FRECUENCIA[frecuencia];
}

/**
 * Siguiente vencimiento a N meses. Si el dia no existe en el mes destino
 * (31 de enero + 1 mes) se usa el ultimo dia de ese mes, no el 3 de marzo.
 */
export function siguienteVencimiento(base: FechaIso, meses: number): FechaIso | null {
  if (meses <= 0) return null;

  const [anio, mes, dia] = base.split("-").map(Number) as [number, number, number];
  const destino = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();

  destino.setUTCDate(Math.min(dia, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

/**
 * Fechas de vencimiento desde `primera` hasta `limite`, inclusive.
 * Una obligacion `unica` produce exactamente una fecha (RF-51).
 */
export function fechasDeRecurrencia(entrada: {
  primera: FechaIso;
  frecuencia: Frecuencia;
  intervaloMeses?: number | null;
  limite: FechaIso;
}): FechaIso[] {
  const meses = mesesPorFrecuencia(entrada.frecuencia, entrada.intervaloMeses);
  const fechas: FechaIso[] = [];

  let fecha: FechaIso | null = entrada.primera;
  // Cota de seguridad: 60 meses de horizonte maximo (RF-101) sobre la frecuencia
  // mas corta posible da 60 ocurrencias; 720 deja margen sin permitir un bucle
  // infinito si llegara un intervalo corrupto.
  for (let i = 0; i < 720 && fecha !== null && fecha <= entrada.limite; i += 1) {
    fechas.push(fecha);
    if (meses === 0) break;
    fecha = siguienteVencimiento(fecha, meses);
  }

  return fechas;
}

/** Fecha limite del horizonte de proyeccion, contada desde hoy (RF-52, RF-101). */
export function limiteDelHorizonte(hoy: FechaIso, horizonteMeses: number): FechaIso {
  return siguienteVencimiento(hoy, Math.max(1, horizonteMeses)) ?? hoy;
}
