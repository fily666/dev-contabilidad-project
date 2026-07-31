import { describe, expect, it } from "vitest";
import {
  COLUMNAS_ESPERADAS,
  leerCsvDeMovimientos,
  leerFechaCsv,
  leerValorCsv,
  PLANTILLA_CSV,
} from "./importacion";

/** Contexto.md RF-27. */

const ENCABEZADO = COLUMNAS_ESPERADAS.join(",");

describe("leerValorCsv", () => {
  it("acepta el formato de es-CO y el anglosajón", () => {
    expect(leerValorCsv("1.250.000")).toBe(1_250_000);
    expect(leerValorCsv("1.250.000,50")).toBe(1_250_000.5);
    expect(leerValorCsv("1250000.5")).toBe(1_250_000.5);
    expect(leerValorCsv("1,250,000")).toBe(1_250_000);
    // Una coma sola es decimal: es lo que teclea quien escribe en es-CO.
    expect(leerValorCsv("450,50")).toBe(450.5);
    expect(leerValorCsv("$ 450.000")).toBe(450_000);
  });

  it("un campo vacío o sin dígitos no es un número", () => {
    expect(Number.isNaN(leerValorCsv(""))).toBe(true);
    expect(Number.isNaN(leerValorCsv("mucho"))).toBe(true);
  });
});

describe("leerFechaCsv", () => {
  it("acepta ISO y dd/MM/yyyy", () => {
    expect(leerFechaCsv("2026-03-05")).toBe("2026-03-05");
    expect(leerFechaCsv("05/03/2026")).toBe("2026-03-05");
    expect(leerFechaCsv("5-3-2026")).toBe("2026-03-05");
  });

  it("rechaza fechas imposibles y texto", () => {
    expect(leerFechaCsv("2026-02-30")).toBeNull();
    expect(leerFechaCsv("ayer")).toBeNull();
    expect(leerFechaCsv("")).toBeNull();
  });
});

describe("leerCsvDeMovimientos", () => {
  it("lee la plantilla de ejemplo sin errores de forma", () => {
    const lectura = leerCsvDeMovimientos(PLANTILLA_CSV);

    expect(lectura.columnasFaltantes).toEqual([]);
    expect(lectura.columnasDesconocidas).toEqual([]);
    expect(lectura.filas).toHaveLength(3);
    expect(lectura.filas.every((f) => f.errores.length === 0)).toBe(true);
    expect(lectura.filas[0]?.datos).toMatchObject({
      fecha: "2026-03-05",
      tipo: "egreso",
      valor: 450_000,
      estado: "pagado",
    });
  });

  it("numera las filas como en el archivo: la primera de datos es la 2", () => {
    const lectura = leerCsvDeMovimientos(
      [ENCABEZADO, "2026-03-05,egreso,Administración,450000,Marzo,Transferencia,pagado,,"].join(
        "\n",
      ),
    );

    expect(lectura.filas[0]?.numero).toBe(2);
  });

  it("una fila inválida no detiene la lectura de las demás (RF-27)", () => {
    const lectura = leerCsvDeMovimientos(
      [
        ENCABEZADO,
        "no-es-fecha,egreso,Administración,450000,Marzo,Transferencia,pagado,,",
        "2026-03-06,egreso,Administración,320000,Abril,Transferencia,pagado,,",
      ].join("\n"),
    );

    expect(lectura.filas).toHaveLength(2);
    expect(lectura.filas[0]?.errores[0]).toContain("fecha");
    expect(lectura.filas[0]?.datos).toBeNull();
    expect(lectura.filas[1]?.datos).not.toBeNull();
  });

  it("detecta el punto y coma que exporta Excel en es-CO", () => {
    const lectura = leerCsvDeMovimientos(
      [
        COLUMNAS_ESPERADAS.join(";"),
        "2026-03-05;egreso;Administración;450.000;Marzo;Transferencia;pagado;;",
      ].join("\n"),
    );

    expect(lectura.filas[0]?.datos?.valor).toBe(450_000);
  });

  it("respeta las comillas dobles y las comas dentro del campo", () => {
    const lectura = leerCsvDeMovimientos(
      [
        ENCABEZADO,
        '2026-03-05,egreso,Administración,450000,"Administración, cuota de marzo",Transferencia,pagado,,',
      ].join("\n"),
    );

    expect(lectura.filas[0]?.datos?.descripcion).toBe("Administración, cuota de marzo");
  });

  it("tolera el encabezado con tildes, mayúsculas y espacios", () => {
    const lectura = leerCsvDeMovimientos(
      [
        "Fecha,Tipo,Categoría,Valor,Descripción,Método Pago,Estado,Observaciones,Proyecto",
        "2026-03-05,egreso,Administración,450000,Marzo,Transferencia,pagado,,",
      ].join("\n"),
    );

    // El normalizador quita tildes, baja a minúsculas y convierte los espacios en
    // guion bajo, así que «Método Pago» sí se reconoce como `metodo_pago`.
    expect(lectura.columnasFaltantes).toEqual([]);
    expect(lectura.columnasDesconocidas).toEqual([]);
    expect(lectura.filas[0]?.datos?.metodoPago).toBe("Transferencia");
  });

  it("dice qué columnas obligatorias faltan", () => {
    const lectura = leerCsvDeMovimientos(["fecha,tipo", "2026-03-05,egreso"].join("\n"));

    expect(lectura.columnasFaltantes).toEqual(["categoria", "valor", "descripcion"]);
  });

  it("un pagado sin método de pago se marca, no se asume", () => {
    const lectura = leerCsvDeMovimientos(
      [ENCABEZADO, "2026-03-05,egreso,Administración,450000,Marzo,,pagado,,"].join("\n"),
    );

    expect(lectura.filas[0]?.errores).toContain("Un movimiento pagado necesita método de pago.");
  });

  it("un archivo vacío no revienta", () => {
    const lectura = leerCsvDeMovimientos("");

    expect(lectura.filas).toEqual([]);
    expect(lectura.columnasFaltantes.length).toBeGreaterThan(0);
  });

  it("descarta el BOM que Excel pone al principio", () => {
    const lectura = leerCsvDeMovimientos(
      `﻿${ENCABEZADO}\n2026-03-05,egreso,Administración,450000,Marzo,Transferencia,pagado,,`,
    );

    expect(lectura.columnasFaltantes).toEqual([]);
    expect(lectura.filas[0]?.datos).not.toBeNull();
  });
});
