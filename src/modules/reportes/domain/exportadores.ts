import type { Reporte } from "./reporte";

/**
 * PUERTOS `GeneradorExcel` y `GeneradorPdf` (Contexto.md §7.3, §11).
 *
 * Reciben el reporte ya armado y devuelven bytes. No consultan nada, no formatean
 * cifras de negocio y no saben de que modulo viene el reporte: cambiar de ExcelJS
 * a otra libreria no debe tocar ni el dominio ni la aplicacion.
 */
export interface GeneradorExcel {
  generar(reporte: Reporte): Promise<Uint8Array>;
}

export interface GeneradorPdf {
  generar(reporte: Reporte): Promise<Uint8Array>;
}
