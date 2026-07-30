import { describe, expect, it } from "vitest";

import { ControlDeIntentos } from "./control-intentos";

const AHORA = 1_800_000_000;

describe("ControlDeIntentos", () => {
  it("no bloquea a quien no ha fallado", () => {
    const control = new ControlDeIntentos();
    expect(control.segundosDeBloqueo("1.2.3.4", AHORA)).toBe(0);
  });

  it("bloquea al alcanzar el maximo de fallos", () => {
    const control = new ControlDeIntentos(3, 300);

    control.registrarFallo("1.2.3.4", AHORA);
    control.registrarFallo("1.2.3.4", AHORA);
    expect(control.segundosDeBloqueo("1.2.3.4", AHORA)).toBe(0);

    control.registrarFallo("1.2.3.4", AHORA);
    expect(control.segundosDeBloqueo("1.2.3.4", AHORA)).toBe(300);
  });

  it("libera el bloqueo cuando pasa el tiempo", () => {
    const control = new ControlDeIntentos(1, 300);
    control.registrarFallo("1.2.3.4", AHORA);

    expect(control.segundosDeBloqueo("1.2.3.4", AHORA + 299)).toBe(1);
    expect(control.segundosDeBloqueo("1.2.3.4", AHORA + 300)).toBe(0);
  });

  it("no castiga a un origen por los fallos de otro", () => {
    const control = new ControlDeIntentos(2, 300);
    control.registrarFallo("1.2.3.4", AHORA);
    control.registrarFallo("1.2.3.4", AHORA);

    expect(control.segundosDeBloqueo("1.2.3.4", AHORA)).toBe(300);
    expect(control.segundosDeBloqueo("5.6.7.8", AHORA)).toBe(0);
  });

  it("un acierto borra los fallos acumulados", () => {
    const control = new ControlDeIntentos(3, 300);
    control.registrarFallo("1.2.3.4", AHORA);
    control.registrarFallo("1.2.3.4", AHORA);
    control.limpiar("1.2.3.4");

    control.registrarFallo("1.2.3.4", AHORA);
    control.registrarFallo("1.2.3.4", AHORA);
    expect(control.segundosDeBloqueo("1.2.3.4", AHORA)).toBe(0);
  });

  /** Tras cumplir el bloqueo, la cuenta arranca de cero, no en el limite. */
  it("da margen completo despues de un bloqueo cumplido", () => {
    const control = new ControlDeIntentos(2, 300);
    control.registrarFallo("1.2.3.4", AHORA);
    control.registrarFallo("1.2.3.4", AHORA);

    const despues = AHORA + 300;
    expect(control.segundosDeBloqueo("1.2.3.4", despues)).toBe(0);

    control.registrarFallo("1.2.3.4", despues);
    expect(control.segundosDeBloqueo("1.2.3.4", despues)).toBe(0);
  });
});
