import { describe, expect, it } from "vitest";
import {
  MAXIMO_FILAS_EXPORTACION,
  exigirTamanoExportable,
  nombreDeArchivo,
  type Reporte,
} from "./reporte";

/** Contexto.md §11, RF-94, RF-95. */

function reporteCon(filas: number): Reporte {
  return {
    tipo: "movimientos",
    titulo: "Reporte de movimientos",
    generadoEn: "2026-07-30T17:00:00.000Z",
    filtros: [],
    columnas: [{ clave: "fecha", etiqueta: "Fecha", tipo: "fecha" }],
    filas: Array.from({ length: filas }, (_, i) => ({ fecha: `2026-07-${(i % 28) + 1}` })),
    totales: [],
    moneda: "COP",
  };
}

describe("exigirTamanoExportable", () => {
  it("admite justo el maximo", () => {
    expect(() => exigirTamanoExportable(reporteCon(MAXIMO_FILAS_EXPORTACION))).not.toThrow();
  });

  it("una fila mas se rechaza en lugar de truncar en silencio (§11)", () => {
    expect(() => exigirTamanoExportable(reporteCon(MAXIMO_FILAS_EXPORTACION + 1))).toThrow(
      /máximo por exportación/,
    );
  });
});

describe("nombreDeArchivo", () => {
  it("sigue el patron {reporte}_{proyecto}_{yyyyMMdd}.{ext}", () => {
    expect(
      nombreDeArchivo({
        tipo: "movimientos",
        proyecto: "Apartamento Chapinero",
        hoy: "2026-07-30",
        extension: "xlsx",
      }),
    ).toBe("movimientos_apartamento-chapinero_20260730.xlsx");
  });

  it("sin proyecto omite ese segmento", () => {
    expect(nombreDeArchivo({ tipo: "flujo", hoy: "2026-07-30", extension: "pdf" })).toBe(
      "flujo_20260730.pdf",
    );
  });

  it("quita tildes y caracteres que no sirven en un nombre de archivo", () => {
    expect(
      nombreDeArchivo({
        tipo: "estado",
        proyecto: "Camión Ñuñoa (2026) #1",
        hoy: "2026-01-05",
        extension: "pdf",
      }),
    ).toBe("estado_camion-nunoa-2026-1_20260105.pdf");
  });
});
