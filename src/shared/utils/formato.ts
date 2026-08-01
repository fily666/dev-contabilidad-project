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

/**
 * Version compacta para tarjetas de indicadores e importes en tabla: `$ 60,5 M`.
 *
 * **Solo dos sufijos, `K` y `M`, y `M` no tiene techo.** Antes había un tercero,
 * `MM` para miles de millones, y en es-CO «MM» se lee habitualmente como
 * *millones*: `$ 1.200 M` y `$ 1,2 MM` son la misma cifra escrita de dos formas
 * que se contradicen para un lector local. Con un solo sufijo por encima del
 * millón, mil doscientos millones se escriben `$ 1.200 M` y no hay ambigüedad que
 * resolver.
 *
 * Se usa en **todos** los importes de una misma vista, tarjetas y tablas
 * incluidas. Mezclarlo con `formatearDinero` dentro de una pantalla obliga a
 * traducir mentalmente entre `$ 320,0 M` y `$ 320.000.000`, que es lo que hacía
 * Patrimonio: compacto en las tarjetas de arriba y completo en la tabla de abajo.
 * `formatearDinero` queda para donde el importe exacto es el dato —el detalle de
 * un movimiento, un reporte que se exporta, el valor de una obligación—.
 */
export function formatearDineroCompacto(valor: number, moneda = "COP"): string {
  const abs = Math.abs(valor);
  const simbolo = moneda === "COP" ? "$" : `${moneda} `;
  const signo = valor < 0 ? "-" : "";
  const conUnidad = (n: number, u: string) =>
    `${signo}${simbolo}${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${u}`;

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

/** Tamaño legible: los bytes crudos no le dicen nada a nadie. */
export function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
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

/**
 * Convierte la entrada del usuario en numero (§8.4). Acepta lo que de verdad
 * escribe alguien en es-CO: `1.250.000`, `1250000,50`, `$ 1.250.000`. El punto
 * solo se descarta cuando separa grupos de tres digitos, para no confundir el
 * separador de miles con el decimal.
 *
 * Vive aqui y no en el esquema Zod porque la usan los dos formularios de importe
 * y el resolver: tres copias de esta expresion regular eran tres sitios donde
 * arreglar el mismo caso raro.
 */
export function aNumero(entrada: string): number {
  const limpio = entrada.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  return Number(limpio.replace(",", "."));
}
