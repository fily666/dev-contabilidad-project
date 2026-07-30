import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** Formato de presentacion de importes (Contexto.md §8.4). */
export function formatearDinero(valor: number, moneda = "COP"): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(valor);
}

/** Version compacta para tarjetas de indicadores: $ 60,5 M */
export function formatearDineroCompacto(valor: number, moneda = "COP"): string {
  const abs = Math.abs(valor);
  const simbolo = moneda === "COP" ? "$" : `${moneda} `;
  const signo = valor < 0 ? "-" : "";
  const conUnidad = (n: number, u: string) =>
    `${signo}${simbolo}${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${u}`;

  if (abs >= 1_000_000_000) return conUnidad(abs / 1_000_000_000, "MM");
  if (abs >= 1_000_000) return conUnidad(abs / 1_000_000, "M");
  if (abs >= 1_000) return conUnidad(abs / 1_000, "K");
  return formatearDinero(valor, moneda);
}

/**
 * Formatea un porcentaje. Devuelve el guion largo cuando el indicador no es
 * calculable, por la guarda de §5.3 (nunca 0 %, NaN ni infinito).
 */
export function formatearPorcentaje(razon: number | null | undefined, decimales = 1): string {
  if (razon === null || razon === undefined || !Number.isFinite(razon)) return "—";
  return `${(razon * 100).toLocaleString("es-CO", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })} %`;
}

/** Muestra un valor numerico o el guion largo si no aplica (§5.3). */
export function formatearOpcional(
  valor: number | null | undefined,
  formateador: (v: number) => string,
): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return formateador(valor);
}

/**
 * `2026-02-05` -> `5 feb 2026`
 *
 * El patron es el que el dueno eligio en los ajustes (RF-101). Se recibe como
 * argumento en lugar de leerse de un contexto global porque este modulo lo usan
 * Server Components, y una fecha debe poder formatearse sin sesion.
 */
export function formatearFecha(fechaIso: string, patron = "d MMM yyyy"): string {
  return format(parseISO(fechaIso), patron, { locale: es });
}

/** `2026-02-05` -> `5 de febrero de 2026` */
export function formatearFechaLarga(fechaIso: string): string {
  return format(parseISO(fechaIso), "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** `2026-02-01` -> `febrero 2026` */
export function formatearMes(fechaIso: string): string {
  return format(parseISO(fechaIso), "MMMM yyyy", { locale: es });
}

/** `2026-02-01` -> `feb 26` (ejes de graficas) */
export function formatearMesCorto(fechaIso: string): string {
  return format(parseISO(fechaIso), "MMM yy", { locale: es });
}

/** Nombre de archivo seguro para Storage (§6.7). */
export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Convierte la entrada del usuario con separadores de miles en numero. */
export function aNumero(entrada: string): number {
  const limpio = entrada.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  return Number(limpio.replace(",", "."));
}
