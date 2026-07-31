import { describe, expect, it } from "vitest";
import {
  fechasDeRecurrencia,
  limiteDelHorizonte,
  mesesPorFrecuencia,
  siguienteVencimiento,
} from "./recurrencia";

/**
 * Contexto.md §5.6 y RF-51. Los mismos casos limite que verifica la version SQL
 * en tests/db/esquema.test.ts: si las dos implementaciones divergen, una de las
 * dos suites lo dice.
 */

describe("mesesPorFrecuencia", () => {
  it("traduce cada frecuencia del catalogo", () => {
    expect(mesesPorFrecuencia("mensual")).toBe(1);
    expect(mesesPorFrecuencia("bimestral")).toBe(2);
    expect(mesesPorFrecuencia("trimestral")).toBe(3);
    expect(mesesPorFrecuencia("semestral")).toBe(6);
    expect(mesesPorFrecuencia("anual")).toBe(12);
  });

  it("la frecuencia unica no se repite: cero meses", () => {
    expect(mesesPorFrecuencia("unica")).toBe(0);
  });

  it("la personalizada usa su intervalo y cae en 1 si falta", () => {
    expect(mesesPorFrecuencia("personalizada", 4)).toBe(4);
    expect(mesesPorFrecuencia("personalizada", null)).toBe(1);
  });
});

describe("siguienteVencimiento", () => {
  it("suma meses conservando el dia", () => {
    expect(siguienteVencimiento("2026-03-15", 1)).toBe("2026-04-15");
    expect(siguienteVencimiento("2026-03-15", 12)).toBe("2027-03-15");
  });

  it("si el dia no existe en el mes destino usa el ultimo dia", () => {
    // El caso que rompe las implementaciones ingenuas: 31 de enero + 1 mes no es
    // el 3 de marzo.
    expect(siguienteVencimiento("2026-01-31", 1)).toBe("2026-02-28");
    expect(siguienteVencimiento("2026-05-31", 1)).toBe("2026-06-30");
  });

  it("respeta el año bisiesto", () => {
    expect(siguienteVencimiento("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("cruza el fin de año", () => {
    expect(siguienteVencimiento("2026-11-30", 2)).toBe("2027-01-30");
  });

  it("sin meses no hay siguiente vencimiento", () => {
    expect(siguienteVencimiento("2026-03-15", 0)).toBeNull();
  });
});

describe("fechasDeRecurrencia", () => {
  it("una obligacion mensual genera una fecha por mes hasta el limite", () => {
    const fechas = fechasDeRecurrencia({
      primera: "2026-08-05",
      frecuencia: "mensual",
      limite: "2026-12-31",
    });

    expect(fechas).toEqual(["2026-08-05", "2026-09-05", "2026-10-05", "2026-11-05", "2026-12-05"]);
  });

  it("una obligacion unica genera exactamente una fecha", () => {
    expect(
      fechasDeRecurrencia({ primera: "2026-09-10", frecuencia: "unica", limite: "2027-12-31" }),
    ).toEqual(["2026-09-10"]);
  });

  it("la personalizada respeta el intervalo", () => {
    expect(
      fechasDeRecurrencia({
        primera: "2026-01-15",
        frecuencia: "personalizada",
        intervaloMeses: 4,
        limite: "2026-12-31",
      }),
    ).toEqual(["2026-01-15", "2026-05-15", "2026-09-15"]);
  });

  it("no genera nada si la primera fecha ya supera el limite", () => {
    expect(
      fechasDeRecurrencia({ primera: "2027-01-01", frecuencia: "mensual", limite: "2026-12-31" }),
    ).toEqual([]);
  });
});

describe("limiteDelHorizonte", () => {
  it("proyecta el horizonte configurado desde hoy (RF-101)", () => {
    expect(limiteDelHorizonte("2026-07-30", 12)).toBe("2027-07-30");
    expect(limiteDelHorizonte("2026-07-30", 1)).toBe("2026-08-30");
  });

  it("un horizonte de cero o negativo se trata como un mes", () => {
    expect(limiteDelHorizonte("2026-07-30", 0)).toBe("2026-08-30");
  });
});
