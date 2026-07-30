import { describe, expect, it } from "vitest";

import { esquemaRegistrarMovimiento } from "./schemas";

/**
 * El esquema es la misma fuente que valida el formulario y la Server Action
 * (§8.7), asi que estas reglas se comprueban una vez aqui.
 *
 * El caso de «pendiente sin metodo de pago» esta escrito a proposito: el
 * formulario guardaba `estado` en un `useState` fuera de React Hook Form, el
 * resolver validaba siempre el valor por omision («pagado») y era imposible
 * registrar un movimiento pendiente. El E2E de §3.1 lo cubre de punta a punta;
 * esto fija la regla al nivel del esquema.
 */

const base = {
  proyectoId: "11111111-1111-4111-8111-111111111111",
  categoriaId: "22222222-2222-4222-8222-222222222222",
  tipo: "egreso" as const,
  fecha: "2026-03-01",
  valor: "1200000",
  descripcion: "Predial 2026",
};

describe("esquemaRegistrarMovimiento", () => {
  it("acepta un movimiento pendiente sin método de pago", () => {
    const r = esquemaRegistrarMovimiento.safeParse({ ...base, estado: "pendiente" });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.estado).toBe("pendiente");
      expect(r.data.metodoPagoId).toBeNull();
    }
  });

  it("exige método de pago cuando el movimiento se marca pagado (§5.7.4)", () => {
    const r = esquemaRegistrarMovimiento.safeParse({ ...base, estado: "pagado" });

    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.join(".") === "metodoPagoId");
      expect(issue?.message).toMatch(/método de pago/i);
    }
  });

  it("acepta el movimiento pagado cuando sí trae método", () => {
    const r = esquemaRegistrarMovimiento.safeParse({
      ...base,
      estado: "pagado",
      metodoPagoId: "33333333-3333-4333-8333-333333333333",
    });

    expect(r.success).toBe(true);
  });

  it("rechaza una naturaleza incompatible con el tipo (§5.7.3)", () => {
    const r = esquemaRegistrarMovimiento.safeParse({
      ...base,
      estado: "pendiente",
      naturaleza: "ingreso",
    });

    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join(".") === "naturaleza")).toBe(true);
    }
  });

  it("exige que capital e intereses sumen el valor de la cuota (RF-29)", () => {
    const r = esquemaRegistrarMovimiento.safeParse({
      ...base,
      estado: "pendiente",
      naturaleza: "financiacion",
      abonoCapital: "800000",
      abonoInteres: "300000", // suma 1.100.000, no 1.200.000
    });

    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /igual al valor de la cuota/i.test(i.message))).toBe(true);
    }
  });
});
