import { describe, expect, it } from "vitest";
import { Dinero, MonedaIncompatible, MontoInvalido } from "./dinero";

describe("Dinero (§8.4, ADR-10)", () => {
  it("suma sin errores de punto flotante", () => {
    // 0.1 + 0.2 con numeros nativos da 0.30000000000000004
    const total = Dinero.de(0.1).mas(Dinero.de(0.2));
    expect(total.valor).toBe(0.3);
  });

  it("no acumula error al sumar muchas veces", () => {
    let total = Dinero.cero();
    for (let i = 0; i < 1000; i += 1) total = total.mas(Dinero.de(0.01));
    expect(total.valor).toBe(10);
  });

  it("redondea a dos decimales al construirse", () => {
    expect(Dinero.de(1234.567).valor).toBe(1234.57);
    expect(Dinero.de(1234.564).valor).toBe(1234.56);
  });

  it("resta y compara", () => {
    const a = Dinero.de(60_000_000);
    const b = Dinero.de(500_000);
    expect(a.menos(b).valor).toBe(59_500_000);
    expect(a.mayorQue(b)).toBe(true);
    expect(b.menorQue(a)).toBe(true);
    expect(a.igualA(Dinero.de(60_000_000))).toBe(true);
  });

  it("suma una lista", () => {
    const total = Dinero.sumar([Dinero.de(1000), Dinero.de(2500), Dinero.de(0.5)]);
    expect(total.valor).toBe(3500.5);
  });

  it("multiplica por un factor", () => {
    expect(Dinero.de(1000).por(0.19).valor).toBe(190);
    expect(Dinero.de(60_500_000).por(1 / 7).valor).toBe(8_642_857.14);
  });

  it("devuelve null al dividir por cero, no Infinity (guarda §5.3)", () => {
    expect(Dinero.de(1000).dividido(Dinero.cero())).toBeNull();
    expect(Dinero.cero().dividido(Dinero.cero())).toBeNull();
  });

  it("calcula la razon cuando el divisor no es cero", () => {
    expect(Dinero.de(2_000_000).dividido(Dinero.de(100_000_000))).toBeCloseTo(0.02, 10);
  });

  it("rechaza operar monedas distintas (invariante §5.7.5)", () => {
    expect(() => Dinero.de(1000, "COP").mas(Dinero.de(1000, "USD"))).toThrow(MonedaIncompatible);
    expect(() => Dinero.de(1000, "COP").dividido(Dinero.de(1000, "USD"))).toThrow(
      MonedaIncompatible,
    );
  });

  it("rechaza montos no finitos", () => {
    expect(() => Dinero.de(Number.NaN)).toThrow(MontoInvalido);
    expect(() => Dinero.de(Number.POSITIVE_INFINITY)).toThrow(MontoInvalido);
  });

  it("normaliza el codigo de moneda a mayusculas", () => {
    expect(Dinero.de(1, "cop").moneda).toBe("COP");
  });

  it("expone signo y valor absoluto", () => {
    expect(Dinero.de(-500).esNegativo()).toBe(true);
    expect(Dinero.de(-500).absoluto().valor).toBe(500);
    expect(Dinero.de(-500).negado().valor).toBe(500);
    expect(Dinero.cero().esCero()).toBe(true);
  });
});
