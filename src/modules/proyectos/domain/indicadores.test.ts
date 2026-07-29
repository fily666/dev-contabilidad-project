import { describe, expect, it } from "vitest";
import {
  calcularEstadoFinanciero,
  calcularIndicadores,
  calcularPayback,
  flujoAcumulado,
  type CifrasProyecto,
} from "./indicadores";

/** Escenario 3.1 de Contexto.md: apartamento arrendado. */
function cifrasApartamento(cambios: Partial<CifrasProyecto> = {}): CifrasProyecto {
  return {
    moneda: "COP",
    fechaInicio: "2024-01-01",
    hoy: "2026-07-29",
    totalInvertido: 100_000_000,
    totalGastosOperativos: 6_000_000,
    totalFinanciacion: 12_000_000,
    totalIngresos: 30_000_000,
    abonosACapital: 4_000_000,
    ingresos12m: 24_000_000,
    gastosOperativos12m: 4_000_000,
    valoracionActual: 130_000_000,
    pasivoTotal: 40_000_000,
    flujoMensual: [],
    ...cambios,
  };
}

describe("calcularIndicadores (§5.1, §5.3)", () => {
  it("separa inversion de gasto operativo y de financiacion", () => {
    const i = calcularIndicadores(cifrasApartamento());
    expect(i.totalInvertido).toBe(100_000_000);
    expect(i.totalGastosOperativos).toBe(6_000_000);
    expect(i.totalFinanciacion).toBe(12_000_000);
    expect(i.totalEgresos).toBe(118_000_000);
    expect(i.balance).toBe(30_000_000 - 118_000_000);
  });

  it("capital aportado = inversion + abonos a capital", () => {
    expect(calcularIndicadores(cifrasApartamento()).capitalAportado).toBe(104_000_000);
  });

  it("NOI anual = ingresos 12m - gastos operativos 12m", () => {
    expect(calcularIndicadores(cifrasApartamento()).noiAnual).toBe(20_000_000);
  });

  it("yields y cap rate", () => {
    const i = calcularIndicadores(cifrasApartamento());
    expect(i.yieldBruto).toBeCloseTo(0.24, 10);
    expect(i.yieldNeto).toBeCloseTo(0.2, 10);
    expect(i.capRate).toBeCloseTo(20_000_000 / 130_000_000, 10);
  });

  it("plusvalia = valoracion - invertido", () => {
    expect(calcularIndicadores(cifrasApartamento()).plusvalia).toBe(30_000_000);
  });

  it("ROI acumulado = (ingresos - opex - financiacion) / invertido", () => {
    const i = calcularIndicadores(cifrasApartamento());
    expect(i.roiAcumulado).toBeCloseTo((30_000_000 - 6_000_000 - 12_000_000) / 100_000_000, 10);
  });

  it("patrimonio neto = valoracion - pasivos", () => {
    expect(calcularIndicadores(cifrasApartamento()).patrimonioNeto).toBe(90_000_000);
  });

  describe("guardas de §5.3: nunca NaN, Infinity ni 0 % enganoso", () => {
    it("devuelve null en los porcentuales cuando no hay inversion", () => {
      const i = calcularIndicadores(cifrasApartamento({ totalInvertido: 0 }));
      expect(i.roiAcumulado).toBeNull();
      expect(i.yieldBruto).toBeNull();
      expect(i.yieldNeto).toBeNull();
      expect(i.retornoTotal).toBeNull();
    });

    it("devuelve null en cap rate cuando no hay valoracion", () => {
      const i = calcularIndicadores(cifrasApartamento({ valoracionActual: null }));
      expect(i.capRate).toBeNull();
      expect(i.plusvalia).toBeNull();
      expect(i.retornoTotal).toBeNull();
      expect(i.patrimonioNeto).toBeNull();
    });

    it("devuelve null en cap rate cuando la valoracion es cero", () => {
      expect(calcularIndicadores(cifrasApartamento({ valoracionActual: 0 })).capRate).toBeNull();
    });

    it("devuelve null en costo mensual el mismo mes de inicio", () => {
      const i = calcularIndicadores(
        cifrasApartamento({ fechaInicio: "2026-07-01", hoy: "2026-07-29" }),
      );
      expect(i.mesesDeHistoria).toBe(0);
      expect(i.costoMensual).toBeNull();
    });
  });

  describe("marca de estimado (§5.3)", () => {
    it("marca estimado con menos de 12 meses de historia", () => {
      const i = calcularIndicadores(
        cifrasApartamento({ fechaInicio: "2026-01-15", hoy: "2026-07-29" }),
      );
      expect(i.mesesDeHistoria).toBe(6);
      expect(i.esEstimado).toBe(true);
    });

    it("no marca estimado con 12 meses o mas", () => {
      const i = calcularIndicadores(
        cifrasApartamento({ fechaInicio: "2025-07-29", hoy: "2026-07-29" }),
      );
      expect(i.mesesDeHistoria).toBe(12);
      expect(i.esEstimado).toBe(false);
    });
  });

  /** Escenario 3.2: vehiculo sin ingresos. */
  describe("proyecto sin ingresos (TCO, §5.3)", () => {
    const moto = cifrasApartamento({
      fechaInicio: "2026-01-29",
      hoy: "2026-07-29",
      totalInvertido: 18_000_000,
      totalGastosOperativos: 1_800_000,
      totalFinanciacion: 0,
      totalIngresos: 0,
      abonosACapital: 0,
      ingresos12m: 0,
      gastosOperativos12m: 1_800_000,
      valoracionActual: 16_000_000,
      pasivoTotal: 0,
    });

    it("TCO es todo lo desembolsado", () => {
      expect(calcularIndicadores(moto).tco).toBe(19_800_000);
    });

    it("costo mensual promedia sobre los meses de vida", () => {
      const i = calcularIndicadores(moto);
      expect(i.mesesDeHistoria).toBe(6);
      expect(i.costoMensual).toBe(3_300_000);
    });

    it("la depreciacion aparece como plusvalia negativa", () => {
      expect(calcularIndicadores(moto).plusvalia).toBe(-2_000_000);
    });

    it("el yield es cero, no null, porque si hay inversion", () => {
      expect(calcularIndicadores(moto).yieldBruto).toBe(0);
    });
  });
});

describe("calcularPayback (§5.3)", () => {
  it("devuelve el primer mes con flujo acumulado no negativo", () => {
    const payback = calcularPayback([
      { mes: "2026-01-01", ingresos: 0, egresos: 300, flujoNeto: -300 },
      { mes: "2026-02-01", ingresos: 100, egresos: 0, flujoNeto: 100 },
      { mes: "2026-03-01", ingresos: 250, egresos: 0, flujoNeto: 250 },
    ]);
    expect(payback).toBe(3);
  });

  it("devuelve null si aun no se recupera la inversion", () => {
    expect(
      calcularPayback([
        { mes: "2026-01-01", ingresos: 0, egresos: 300, flujoNeto: -300 },
        { mes: "2026-02-01", ingresos: 50, egresos: 0, flujoNeto: 50 },
      ]),
    ).toBeNull();
  });

  it("devuelve null sin historia", () => {
    expect(calcularPayback([])).toBeNull();
  });

  it("no depende del orden de entrada", () => {
    const payback = calcularPayback([
      { mes: "2026-03-01", ingresos: 250, egresos: 0, flujoNeto: 250 },
      { mes: "2026-01-01", ingresos: 0, egresos: 300, flujoNeto: -300 },
      { mes: "2026-02-01", ingresos: 100, egresos: 0, flujoNeto: 100 },
    ]);
    expect(payback).toBe(3);
  });
});

describe("flujoAcumulado (RF-71)", () => {
  it("acumula en orden cronologico", () => {
    const serie = flujoAcumulado([
      { mes: "2026-02-01", ingresos: 100, egresos: 0, flujoNeto: 100 },
      { mes: "2026-01-01", ingresos: 0, egresos: 300, flujoNeto: -300 },
    ]);
    expect(serie.map((s) => s.acumulado)).toEqual([-300, -200]);
  });
});

describe("calcularEstadoFinanciero (§5.5)", () => {
  const base = {
    obligacionesVencidas: 0,
    obligacionesPorVencer7Dias: 0,
    flujoUltimos3Meses: 1_000_000,
    generaIngresos: true,
    presupuestoExcedido: false,
    ejecucionPresupuesto: null,
  };

  it("riesgo con obligaciones vencidas", () => {
    const r = calcularEstadoFinanciero({ ...base, obligacionesVencidas: 2 });
    expect(r.estado).toBe("riesgo");
    expect(r.motivo).toContain("2");
  });

  it("riesgo con presupuesto excedido", () => {
    expect(calcularEstadoFinanciero({ ...base, presupuestoExcedido: true }).estado).toBe("riesgo");
  });

  it("riesgo con flujo negativo si el proyecto deberia generar ingresos", () => {
    expect(calcularEstadoFinanciero({ ...base, flujoUltimos3Meses: -1 }).estado).toBe("riesgo");
  });

  it("no penaliza el flujo negativo en proyectos sin ingresos", () => {
    expect(
      calcularEstadoFinanciero({ ...base, flujoUltimos3Meses: -1, generaIngresos: false }).estado,
    ).toBe("saludable");
  });

  it("observacion con obligaciones por vencer en 7 dias", () => {
    expect(calcularEstadoFinanciero({ ...base, obligacionesPorVencer7Dias: 1 }).estado).toBe(
      "observacion",
    );
  });

  it("observacion al superar el 80 % del presupuesto", () => {
    expect(calcularEstadoFinanciero({ ...base, ejecucionPresupuesto: 0.85 }).estado).toBe(
      "observacion",
    );
  });

  it("saludable sin senales de alerta", () => {
    expect(calcularEstadoFinanciero(base).estado).toBe("saludable");
  });

  it("las obligaciones vencidas tienen prioridad sobre lo demas", () => {
    const r = calcularEstadoFinanciero({
      ...base,
      obligacionesVencidas: 1,
      obligacionesPorVencer7Dias: 5,
      ejecucionPresupuesto: 0.9,
    });
    expect(r.estado).toBe("riesgo");
    expect(r.motivo).toContain("vencida");
  });
});
