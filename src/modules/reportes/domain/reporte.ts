import { ReglaDeNegocioViolada } from "@/shared/domain/errores";

/**
 * Estructura neutral de un reporte (Contexto.md §11).
 *
 * Ni Excel ni PDF conocen movimientos, obligaciones ni proyectos: reciben esto.
 * Es lo que permite tener un solo exportador por formato en lugar de uno por
 * reporte, y lo que hace que agregar un reporte no toque la infraestructura.
 */

export const TIPOS_REPORTE = ["movimientos", "flujo", "obligaciones", "estado"] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export type TipoColumna = "texto" | "numero" | "dinero" | "fecha" | "porcentaje";

export type ColumnaReporte = {
  clave: string;
  etiqueta: string;
  tipo: TipoColumna;
  /** Ancho sugerido en caracteres, para Excel y PDF. */
  ancho?: number;
};

export type FilaReporte = Record<string, string | number | null>;

export type Reporte = {
  tipo: TipoReporte;
  titulo: string;
  /** ISO completo: el PDF y el Excel muestran fecha de generacion (RF-95). */
  generadoEn: string;
  /** Filtros aplicados, en texto legible: van en el encabezado (RF-94, RF-95). */
  filtros: Array<{ etiqueta: string; valor: string }>;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
  totales: Array<{ etiqueta: string; valor: string }>;
  moneda: string;
};

/** §11: tope de filas por exportacion. */
export const MAXIMO_FILAS_EXPORTACION = 10_000;

/**
 * §11: si el reporte excede el tope, no se genera un archivo a medias ni se
 * truncan filas en silencio: se pide refinar los filtros.
 */
export function exigirTamanoExportable(reporte: Reporte): void {
  if (reporte.filas.length > MAXIMO_FILAS_EXPORTACION) {
    throw new ReglaDeNegocioViolada(
      "EXPORTACION_DEMASIADO_GRANDE",
      `El reporte tiene ${reporte.filas.length} filas y el máximo por exportación es ${MAXIMO_FILAS_EXPORTACION}. Refina los filtros.`,
    );
  }
}

/** §11: `{reporte}_{proyecto}_{yyyyMMdd}.{ext}` */
export function nombreDeArchivo(entrada: {
  tipo: TipoReporte;
  proyecto?: string | null;
  hoy: string;
  extension: "xlsx" | "pdf";
}): string {
  const proyecto = entrada.proyecto
    ? `_${entrada.proyecto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)}`
    : "";

  return `${entrada.tipo}${proyecto}_${entrada.hoy.replaceAll("-", "")}.${entrada.extension}`;
}
