import { describe, expect, it } from "vitest";

import { agruparAgenda, leerVentana, resumirAgenda, VENTANA_POR_OMISION } from "./agenda";
import type { EventoAgenda } from "./obligacion.repository";

/** Contexto.md RF-58, RF-73 y ADR-11: una sola definición de cada cifra. */

let n = 0;

function evento(diasRestantes: number, valorEstimado: number, moneda = "COP"): EventoAgenda {
  n += 1;
  return {
    ocurrenciaId: `oc-${n}`,
    obligacionId: `ob-${n}`,
    proyectoId: "p1",
    proyectoNombre: "Apartamento 402",
    concepto: `Concepto ${n}`,
    categoriaId: "c1",
    fechaVencimiento: "2026-07-31",
    valorEstimado,
    moneda,
    estado: diasRestantes < 0 ? "vencida" : "pendiente",
    diasRestantes,
    movimientoId: null,
  };
}

describe("resumirAgenda", () => {
  it("separa lo vencido de lo que queda por vencer", () => {
    const resumen = resumirAgenda(
      [evento(-12, 1_200_000), evento(-1, 600_000), evento(3, 400_000), evento(20, 2_000_000)],
      "COP",
    );

    expect(resumen.vencidas).toBe(2);
    expect(resumen.importeVencido).toBe(1_800_000);
    expect(resumen.porVencer).toBe(2);
    expect(resumen.importePorVencer).toBe(2_400_000);
  });

  /**
   * La prueba que fija el defecto corregido: lo comprometido por vencer NO
   * incluye lo vencido. Las dos cifras conviven en la misma pantalla y sumar lo
   * vencido en la de «comprometido» era lo que las hacía discrepar.
   */
  it("lo comprometido por vencer excluye lo ya vencido", () => {
    const resumen = resumirAgenda([evento(-30, 5_000_000), evento(10, 100_000)], "COP");

    expect(resumen.importePorVencer).toBe(100_000);
    expect(resumen.importeVencido).toBe(5_000_000);
    // Y el total de la ventana es la suma de los dos, no ninguno de ellos.
    expect(resumen.total).toBe(2);
  });

  it("los 7 días son un subconjunto de lo por vencer, no otro eje", () => {
    const resumen = resumirAgenda([evento(0, 100), evento(7, 200), evento(8, 400)], "COP");

    expect(resumen.proximas7).toBe(2);
    expect(resumen.importe7).toBe(300);
    // El de 8 días cuenta como por vencer pero no como de esta semana.
    expect(resumen.porVencer).toBe(3);
    expect(resumen.importePorVencer).toBe(700);
  });

  it("vence hoy cuenta como por vencer, no como vencido", () => {
    const resumen = resumirAgenda([evento(0, 900)], "COP");

    expect(resumen.vencidas).toBe(0);
    expect(resumen.proximas7).toBe(1);
  });

  it("sin eventos devuelve ceros y la moneda por omision", () => {
    const resumen = resumirAgenda([], "USD");

    expect(resumen).toMatchObject({
      vencidas: 0,
      importeVencido: 0,
      porVencer: 0,
      importePorVencer: 0,
      total: 0,
      moneda: "USD",
    });
  });
});

describe("agruparAgenda", () => {
  it("ordena los grupos por urgencia y da a cada uno su subtotal", () => {
    const grupos = agruparAgenda(
      [evento(20, 2_000), evento(-5, 1_000), evento(2, 300), evento(5, 700)],
      "COP",
    );

    expect(grupos.map((g) => g.clave)).toEqual(["vencidas", "semana", "resto"]);
    expect(grupos.map((g) => g.total)).toEqual([1_000, 1_000, 2_000]);
  });

  /**
   * La suma de los subtotales es el total de la ventana. Es la propiedad que
   * hace imposible la contradicción anterior: ninguna cifra del panel puede
   * discrepar de la tarjeta que resume su mismo grupo.
   */
  it("los subtotales suman el total de la ventana", () => {
    const eventos = [evento(-5, 1_000), evento(2, 300), evento(30, 5_000)];
    const grupos = agruparAgenda(eventos, "COP");
    const resumen = resumirAgenda(eventos, "COP");

    const suma = grupos.reduce((acc, g) => acc + g.total, 0);
    expect(suma).toBe(resumen.importeVencido + resumen.importePorVencer);
  });

  it("no devuelve grupos vacios", () => {
    const grupos = agruparAgenda([evento(3, 100)], "COP");

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.clave).toBe("semana");
  });

  it("sin eventos no devuelve grupos", () => {
    expect(agruparAgenda([], "COP")).toEqual([]);
  });
});

describe("leerVentana (RF-58)", () => {
  it("acepta las tres ventanas del requerimiento", () => {
    expect(leerVentana("7")).toBe(7);
    expect(leerVentana("30")).toBe(30);
    expect(leerVentana("90")).toBe(90);
  });

  it("descarta cualquier otro valor y cae en la ventana por omision", () => {
    // Una URL manipulada a mano no debe llegar al dominio con un valor arbitrario
    // (§7.2, `leer-filtros`): 45 días no es una ventana de RF-58.
    for (const crudo of [undefined, "", "45", "0", "-30", "abc", "30.5"]) {
      expect(leerVentana(crudo)).toBe(VENTANA_POR_OMISION);
    }
  });

  it("con el parametro repetido toma el primero", () => {
    expect(leerVentana(["90", "7"])).toBe(90);
  });
});
