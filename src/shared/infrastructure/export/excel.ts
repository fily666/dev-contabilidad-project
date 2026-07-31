import "server-only";

import ExcelJS from "exceljs";
import type { GeneradorExcel } from "@/modules/reportes/domain/exportadores";
import type { Reporte } from "@/modules/reportes/domain/reporte";

/**
 * ADAPTADOR del puerto GeneradorExcel (Contexto.md §7.3, §11).
 *
 * Dos hojas: «Datos» con los registros y «Resumen» con los filtros aplicados y
 * los totales. Las columnas de dinero llevan formato de moneda de Excel —no un
 * texto ya formateado— para que el archivo sirva para seguir calculando, que es
 * la razon de exportar a Excel y no a PDF.
 */
export class ExcelJsGenerador implements GeneradorExcel {
  async generar(reporte: Reporte): Promise<Uint8Array> {
    const libro = new ExcelJS.Workbook();
    libro.creator = "Gestor Financiero";
    libro.created = new Date(reporte.generadoEn);

    const datos = libro.addWorksheet("Datos", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    datos.columns = reporte.columnas.map((columna) => ({
      header: columna.etiqueta,
      key: columna.clave,
      width: columna.ancho ?? 18,
      style:
        columna.tipo === "dinero"
          ? { numFmt: `"$"#,##0;[Red]-"$"#,##0` }
          : columna.tipo === "porcentaje"
            ? { numFmt: "0.0%" }
            : {},
    }));

    datos.getRow(1).font = { bold: true };
    datos.getRow(1).alignment = { vertical: "middle" };

    for (const fila of reporte.filas) {
      datos.addRow(fila);
    }

    datos.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: reporte.columnas.length },
    };

    const resumen = libro.addWorksheet("Resumen");
    resumen.columns = [
      { header: "Concepto", key: "concepto", width: 30 },
      { header: "Valor", key: "valor", width: 30 },
    ];
    resumen.getRow(1).font = { bold: true };

    resumen.addRow({ concepto: "Reporte", valor: reporte.titulo });
    resumen.addRow({ concepto: "Generado", valor: reporte.generadoEn });
    resumen.addRow({ concepto: "Moneda", valor: reporte.moneda });
    resumen.addRow({ concepto: "Filas", valor: reporte.filas.length });
    resumen.addRow({});
    resumen.addRow({ concepto: "Filtros aplicados", valor: "" }).font = { bold: true };
    for (const filtro of reporte.filtros) {
      resumen.addRow({ concepto: filtro.etiqueta, valor: filtro.valor });
    }
    resumen.addRow({});
    resumen.addRow({ concepto: "Totales", valor: "" }).font = { bold: true };
    for (const total of reporte.totales) {
      const numero = Number(total.valor);
      resumen.addRow({
        concepto: total.etiqueta,
        valor: Number.isFinite(numero) ? numero : total.valor,
      });
    }

    const buffer = await libro.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }
}
