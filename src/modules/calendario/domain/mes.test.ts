import { describe, expect, it } from "vitest";
import {
  claveDeMes,
  comprometidoDelMes,
  construirMes,
  esClaveDeMes,
  mesAnterior,
  mesSiguiente,
  primerDiaDelMes,
  resumirMes,
  ultimoDiaDelMes,
  type EventoCalendario,
} from "./mes";

/** Contexto.md RF-60 a RF-63. */

function evento(parciales: Partial<EventoCalendario> & { fecha: string }): EventoCalendario {
  return {
    id: `evento-${parciales.fecha}-${parciales.concepto ?? "x"}`,
    clase: "ocurrencia",
    concepto: "Cuota",
    proyectoId: "p1",
    proyectoNombre: "Proyecto",
    valor: 100_000,
    moneda: "COP",
    tipo: "egreso",
    estado: "pendiente",
    ...parciales,
  };
}

describe("Aritmetica de meses", () => {
  it("resuelve clave, primer y ultimo dia", () => {
    expect(claveDeMes("2026-02-17")).toBe("2026-02");
    expect(primerDiaDelMes("2026-02")).toBe("2026-02-01");
    expect(ultimoDiaDelMes("2026-02")).toBe("2026-02-28");
    // 2028 es bisiesto: el ultimo dia de febrero cambia.
    expect(ultimoDiaDelMes("2028-02")).toBe("2028-02-29");
    expect(ultimoDiaDelMes("2026-12")).toBe("2026-12-31");
  });

  it("navega entre meses cruzando el año", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSiguiente("2026-12")).toBe("2027-01");
  });

  it("valida la clave de mes", () => {
    expect(esClaveDeMes("2026-07")).toBe(true);
    expect(esClaveDeMes("2026-13")).toBe(false);
    expect(esClaveDeMes("2026-7")).toBe(false);
  });
});

describe("construirMes", () => {
  it("la rejilla empieza en lunes y cubre semanas completas", () => {
    // El 1 de julio de 2026 es miercoles: la rejilla arranca el lunes 29 de junio.
    const dias = construirMes({ mes: "2026-07", hoy: "2026-07-30", eventos: [] });

    expect(dias[0]?.fecha).toBe("2026-06-29");
    expect(dias[0]?.delMes).toBe(false);
    expect(dias.length % 7).toBe(0);
    expect(dias.filter((d) => d.delMes)).toHaveLength(31);
    expect(dias.at(-1)?.delMes).toBe(false);
  });

  it("un mes que empieza en lunes no lleva relleno inicial", () => {
    // El 1 de junio de 2026 es lunes.
    const dias = construirMes({ mes: "2026-06", hoy: "2026-06-15", eventos: [] });
    expect(dias[0]?.fecha).toBe("2026-06-01");
    expect(dias[0]?.delMes).toBe(true);
  });

  it("marca el dia de hoy y coloca cada evento en su fecha", () => {
    const dias = construirMes({
      mes: "2026-07",
      hoy: "2026-07-30",
      eventos: [
        evento({ fecha: "2026-07-05", concepto: "Administración" }),
        evento({ fecha: "2026-07-05", concepto: "Crédito", valor: 1_500_000 }),
        evento({ fecha: "2026-07-30", concepto: "Predial" }),
      ],
    });

    const cinco = dias.find((d) => d.fecha === "2026-07-05");
    // Ordenados por valor descendente: primero el que mas pesa.
    expect(cinco?.eventos.map((e) => e.concepto)).toEqual(["Crédito", "Administración"]);
    expect(dias.find((d) => d.fecha === "2026-07-30")?.esHoy).toBe(true);
    expect(dias.filter((d) => d.esHoy)).toHaveLength(1);
  });

  it("solo lo pendiente o vencido cuenta como comprometido (§5.2)", () => {
    const dias = construirMes({
      mes: "2026-07",
      hoy: "2026-07-30",
      eventos: [
        evento({ fecha: "2026-07-05", estado: "pendiente", valor: 100 }),
        evento({ fecha: "2026-07-06", estado: "vencida", valor: 200, concepto: "Vencida" }),
        evento({ fecha: "2026-07-07", estado: "pagada", valor: 400, concepto: "Pagada" }),
        evento({ fecha: "2026-07-08", estado: "omitida", valor: 800, concepto: "Omitida" }),
      ],
    });

    expect(comprometidoDelMes(dias)).toBe(300);
  });

  it("el relleno de otros meses no suma al comprometido del mes", () => {
    const dias = construirMes({
      mes: "2026-07",
      hoy: "2026-07-30",
      eventos: [evento({ fecha: "2026-06-29", valor: 999_999, concepto: "Del mes anterior" })],
    });

    expect(comprometidoDelMes(dias)).toBe(0);
    expect(dias.find((d) => d.fecha === "2026-06-29")?.eventos).toHaveLength(1);
  });
});

describe("resumirMes", () => {
  const dias = construirMes({
    mes: "2026-07",
    hoy: "2026-07-30",
    eventos: [
      evento({ fecha: "2026-07-05", estado: "pendiente", valor: 100 }),
      evento({ fecha: "2026-07-06", estado: "vencida", valor: 200, concepto: "Vencida" }),
      evento({ fecha: "2026-07-07", estado: "vencido", valor: 50, concepto: "Vencido mov" }),
      evento({ fecha: "2026-07-08", estado: "pagada", valor: 400, concepto: "Pagada" }),
      evento({ fecha: "2026-07-09", estado: "omitida", valor: 800, concepto: "Omitida" }),
      // Relleno de la primera semana: no es del mes y no debe contarse en nada.
      evento({ fecha: "2026-06-29", valor: 999_999, concepto: "Del mes anterior" }),
    ],
  });

  it("lo vencido va aparte del comprometido, no restado ni duplicado", () => {
    const resumen = resumirMes(dias);

    // Pendiente 100 + vencida 200 + vencido 50: lo vencido sigue sin salir de caja.
    expect(resumen.comprometido).toBe(350);
    // Y ademas se publica solo, que es lo que la vista no podia responder.
    expect(resumen.vencidos).toBe(2);
    expect(resumen.importeVencido).toBe(250);
  });

  it("cuenta lo ejecutado y los eventos del mes sin el relleno", () => {
    const resumen = resumirMes(dias);

    expect(resumen.pagado).toBe(400);
    // Cinco del mes; el del 29 de junio queda fuera aunque este en la rejilla.
    expect(resumen.eventos).toBe(5);
  });

  it("no contradice a comprometidoDelMes, que es la misma cifra", () => {
    expect(resumirMes(dias).comprometido).toBe(comprometidoDelMes(dias));
  });
});
