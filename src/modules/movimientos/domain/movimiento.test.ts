import { describe, expect, it } from "vitest";
import { ErrorDeDominio } from "@/shared/domain/errores";
import { Movimiento, type EntradaCrearMovimiento } from "./movimiento.entity";

function entrada(cambios: Partial<EntradaCrearMovimiento> = {}): EntradaCrearMovimiento {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    propietarioId: "22222222-2222-4222-8222-222222222222",
    proyectoId: "33333333-3333-4333-8333-333333333333",
    categoriaId: "44444444-4444-4444-8444-444444444444",
    naturalezaDeCategoria: "opex",
    tipo: "egreso",
    fecha: "2026-02-05",
    valor: 500_000,
    moneda: "COP",
    descripcion: "Administración febrero",
    ...cambios,
  };
}

function codigo(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof ErrorDeDominio) return error.codigo;
    throw error;
  }
  throw new Error("Se esperaba un error de dominio y no se lanzó ninguno.");
}

describe("Movimiento (§5.7)", () => {
  it("hereda la naturaleza de la categoria (RF-21)", () => {
    expect(Movimiento.crear(entrada()).naturaleza).toBe("opex");
  });

  it("permite sobreescribir la naturaleza propuesta (RF-21)", () => {
    const m = Movimiento.crear(entrada({ naturaleza: "capex" }));
    expect(m.naturaleza).toBe("capex");
    expect(m.esInversion()).toBe(true);
  });

  it("rechaza naturaleza incompatible con el tipo (§5.7.3)", () => {
    expect(codigo(() => Movimiento.crear(entrada({ tipo: "egreso", naturaleza: "ingreso" })))).toBe(
      "CATEGORIA_INCOMPATIBLE",
    );
    expect(
      codigo(() =>
        Movimiento.crear(
          entrada({ tipo: "ingreso", naturalezaDeCategoria: "ingreso", naturaleza: "capex" }),
        ),
      ),
    ).toBe("CATEGORIA_INCOMPATIBLE");
  });

  it("exige valor positivo (§5.7.2)", () => {
    expect(codigo(() => Movimiento.crear(entrada({ valor: 0 })))).toBe("VALOR_NO_POSITIVO");
    expect(codigo(() => Movimiento.crear(entrada({ valor: -100 })))).toBe("VALOR_NO_POSITIVO");
  });

  it("valida la descripcion", () => {
    expect(codigo(() => Movimiento.crear(entrada({ descripcion: "   " })))).toBe(
      "DESCRIPCION_INVALIDA",
    );
    expect(codigo(() => Movimiento.crear(entrada({ descripcion: "x".repeat(201) })))).toBe(
      "DESCRIPCION_INVALIDA",
    );
  });

  it("valida el formato de fecha", () => {
    expect(codigo(() => Movimiento.crear(entrada({ fecha: "05/02/2026" })))).toBe("FECHA_INVALIDA");
    expect(codigo(() => Movimiento.crear(entrada({ fecha: "2026-02-30" })))).toBe("FECHA_INVALIDA");
  });

  it("nace pendiente por defecto y no afecta caja (regla de oro §2)", () => {
    const m = Movimiento.crear(entrada());
    expect(m.estado).toBe("pendiente");
    expect(m.afectaCaja()).toBe(false);
    expect(m.fechaPago).toBeNull();
  });

  it("un movimiento pagado exige metodo de pago (§5.7.4)", () => {
    expect(codigo(() => Movimiento.crear(entrada({ estado: "pagado" })))).toBe(
      "METODO_PAGO_REQUERIDO",
    );
  });

  it("al crearse pagado toma la fecha del movimiento como fecha de pago", () => {
    const m = Movimiento.crear(
      entrada({ estado: "pagado", metodoPagoId: "55555555-5555-4555-8555-555555555555" }),
    );
    expect(m.fechaPago).toBe("2026-02-05");
    expect(m.afectaCaja()).toBe(true);
  });

  describe("estadoEfectivo (RF-25)", () => {
    it("presenta como vencido un pendiente con vencimiento pasado", () => {
      const m = Movimiento.crear(entrada({ fechaVencimiento: "2026-03-10" }));
      expect(m.estadoEfectivo("2026-03-11")).toBe("vencido");
    });

    it("sigue pendiente el dia del vencimiento", () => {
      const m = Movimiento.crear(entrada({ fechaVencimiento: "2026-03-10" }));
      expect(m.estadoEfectivo("2026-03-10")).toBe("pendiente");
    });

    it("no altera el estado de un pagado", () => {
      const m = Movimiento.crear(
        entrada({
          estado: "pagado",
          metodoPagoId: "55555555-5555-4555-8555-555555555555",
          fechaVencimiento: "2026-01-01",
        }),
      );
      expect(m.estadoEfectivo("2026-12-31")).toBe("pagado");
    });
  });

  describe("marcarPagado (RF-26)", () => {
    it("registra fecha y metodo", () => {
      const m = Movimiento.crear(entrada());
      m.marcarPagado({ fechaPago: "2026-02-10", metodoPagoId: "abc" });
      expect(m.estado).toBe("pagado");
      expect(m.fechaPago).toBe("2026-02-10");
      expect(m.afectaCaja()).toBe(true);
    });

    it("no admite pagar dos veces", () => {
      const m = Movimiento.crear(entrada());
      m.marcarPagado({ fechaPago: "2026-02-10", metodoPagoId: "abc" });
      expect(codigo(() => m.marcarPagado({ fechaPago: "2026-02-11", metodoPagoId: "abc" }))).toBe(
        "MOVIMIENTO_YA_PAGADO",
      );
    });
  });

  describe("anular (RF-22, ADR-12)", () => {
    it("exige motivo con contenido", () => {
      const m = Movimiento.crear(entrada());
      expect(codigo(() => m.anular("  "))).toBe("MOTIVO_REQUERIDO");
      expect(codigo(() => m.anular("ok"))).toBe("MOTIVO_REQUERIDO");
    });

    it("conserva el registro y lo saca de la caja", () => {
      const m = Movimiento.crear(
        entrada({ estado: "pagado", metodoPagoId: "55555555-5555-4555-8555-555555555555" }),
      );
      m.anular("Registrado por error");
      expect(m.estado).toBe("anulado");
      expect(m.afectaCaja()).toBe(false);
      expect(m.aDatos().motivoAnulacion).toBe("Registrado por error");
      // El importe sigue disponible para auditoria.
      expect(m.dinero.valor).toBe(500_000);
    });

    it("un anulado no admite cambios ni doble anulacion", () => {
      const m = Movimiento.crear(entrada());
      m.anular("Registrado por error");
      expect(codigo(() => m.anular("Otra vez"))).toBe("MOVIMIENTO_ANULADO");
      expect(codigo(() => m.marcarPagado({ fechaPago: "2026-02-10", metodoPagoId: "abc" }))).toBe(
        "MOVIMIENTO_ANULADO",
      );
      expect(
        codigo(() =>
          m.actualizar({
            categoriaId: "44444444-4444-4444-8444-444444444444",
            naturalezaDeCategoria: "opex",
            tipo: "egreso",
            fecha: "2026-02-05",
            valor: 1000,
            descripcion: "Cambio",
          }),
        ),
      ).toBe("MOVIMIENTO_ANULADO");
    });
  });

  describe("desglose de cuota de credito (RF-29)", () => {
    const financiacion = {
      naturalezaDeCategoria: "financiacion" as const,
      valor: 1_000_000,
    };

    it("acepta capital + interes igual al valor", () => {
      const m = Movimiento.crear(
        entrada({ ...financiacion, abonoCapital: 400_000, abonoInteres: 600_000 }),
      );
      expect(m.aDatos().abonoCapital).toBe(400_000);
      expect(m.aDatos().abonoInteres).toBe(600_000);
    });

    it("rechaza sumas que no cuadran", () => {
      expect(
        codigo(() =>
          Movimiento.crear(
            entrada({ ...financiacion, abonoCapital: 400_000, abonoInteres: 400_000 }),
          ),
        ),
      ).toBe("DESGLOSE_INVALIDO");
    });

    it("rechaza desglose incompleto", () => {
      expect(
        codigo(() => Movimiento.crear(entrada({ ...financiacion, abonoCapital: 400_000 }))),
      ).toBe("DESGLOSE_INCOMPLETO");
    });

    it("rechaza desglose en movimientos que no son de financiacion", () => {
      expect(
        codigo(() => Movimiento.crear(entrada({ abonoCapital: 100_000, abonoInteres: 400_000 }))),
      ).toBe("DESGLOSE_NO_APLICA");
    });

    it("rechaza montos negativos en el desglose", () => {
      expect(
        codigo(() =>
          Movimiento.crear(
            entrada({ ...financiacion, abonoCapital: -100_000, abonoInteres: 1_100_000 }),
          ),
        ),
      ).toBe("DESGLOSE_INVALIDO");
    });
  });

  describe("esInversion (§5.1)", () => {
    it("solo capitaliza el egreso de naturaleza capex", () => {
      expect(Movimiento.crear(entrada({ naturaleza: "capex" })).esInversion()).toBe(true);
      expect(Movimiento.crear(entrada({ naturaleza: "opex" })).esInversion()).toBe(false);
      expect(
        Movimiento.crear(
          entrada({ naturalezaDeCategoria: "financiacion", naturaleza: "financiacion" }),
        ).esInversion(),
      ).toBe(false);
      expect(
        Movimiento.crear(
          entrada({ tipo: "ingreso", naturalezaDeCategoria: "ingreso" }),
        ).esInversion(),
      ).toBe(false);
    });
  });
});
