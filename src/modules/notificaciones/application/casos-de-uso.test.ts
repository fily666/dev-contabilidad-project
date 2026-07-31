import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";
import { ObligacionRepositoryEnMemoria } from "@/modules/obligaciones/application/dobles";
import { Obligacion } from "@/modules/obligaciones/domain/obligacion.entity";

import { INTENTOS_MAXIMOS } from "../domain/notificacion.entity";
import { plantillaAviso, plantillaResumen } from "../domain/plantillas";
import {
  EnviarNotificaciones,
  ListarNotificaciones,
  ProgramarAvisos,
  type ConfiguracionAvisos,
} from "./casos-de-uso";
import { NotificacionRepositoryEnMemoria, NotificadorEmailEnMemoria } from "./dobles";

/** Contexto.md §8.8: notificaciones (§10, RF-53, RF-102). */

const HOY = "2026-07-30";
const PROYECTO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORIA = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";

const CONFIGURACION: ConfiguracionAvisos = {
  canales: ["email", "in_app"],
  diasAviso: [5, 1],
  emailDestino: "dueno@ejemplo.com",
  urlBase: "https://app.ejemplo.com",
};

function montar() {
  const notificaciones = new NotificacionRepositoryEnMemoria();
  const obligaciones = new ObligacionRepositoryEnMemoria();
  obligaciones.hoy = HOY;
  const email = new NotificadorEmailEnMemoria();
  const reloj = new RelojFijo(HOY);
  let contador = 0;
  const nuevoId = () => `0a000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`;

  return {
    notificaciones,
    obligaciones,
    email,
    reloj,
    programar: new ProgramarAvisos(notificaciones, obligaciones, reloj, nuevoId),
    enviar: new EnviarNotificaciones(notificaciones, email, reloj),
    listar: new ListarNotificaciones(notificaciones),
  };
}

async function conObligacion(
  contexto: ReturnType<typeof montar>,
  fechaVencimiento: string,
  diasAviso?: number[],
) {
  await contexto.obligaciones.guardar(
    Obligacion.crear({
      id: "0b000000-0000-4000-8000-000000000001",
      proyectoId: PROYECTO,
      categoriaId: CATEGORIA,
      concepto: "Cuota del crédito",
      valorEstimado: 1_500_000,
      fechaVencimiento,
      frecuencia: "unica",
      diasAviso,
    }),
  );
  await contexto.obligaciones.generarOcurrencias(3);
}

describe("Plantillas (§10.3)", () => {
  it("el aviso individual lleva proyecto, concepto, valor, fecha y enlace", () => {
    const plantilla = plantillaAviso({
      proyecto: "Apartamento",
      concepto: "Administración",
      valorEstimado: 450_000,
      moneda: "COP",
      fechaVencimiento: "2026-08-05",
      diasRestantes: 5,
      enlace: "https://app.ejemplo.com/obligaciones",
    });

    expect(plantilla.asunto).toContain("Administración");
    expect(plantilla.asunto).toContain("vence en 5 días");
    expect(plantilla.texto).toContain("Apartamento");
    expect(plantilla.texto).toContain("2026-08-05");
    expect(plantilla.html).toContain("https://app.ejemplo.com/obligaciones");
  });

  it("el aviso de algo vencido lo dice en el asunto", () => {
    const plantilla = plantillaAviso({
      proyecto: "Apartamento",
      concepto: "Predial",
      valorEstimado: 900_000,
      moneda: "COP",
      fechaVencimiento: "2026-07-01",
      diasRestantes: -29,
      enlace: "https://app.ejemplo.com/obligaciones",
    });

    expect(plantilla.asunto).toContain("Vencido");
  });

  it("el resumen suma los vencimientos de la semana", () => {
    const plantilla = plantillaResumen({
      enlace: "https://app.ejemplo.com/calendario",
      eventos: [
        {
          proyecto: "Apartamento",
          concepto: "Administración",
          valorEstimado: 450_000,
          moneda: "COP",
          fechaVencimiento: "2026-08-05",
          diasRestantes: 6,
          enlace: "https://app.ejemplo.com/obligaciones",
        },
        {
          proyecto: "Moto",
          concepto: "SOAT",
          valorEstimado: 550_000,
          moneda: "COP",
          fechaVencimiento: "2026-08-06",
          diasRestantes: 7,
          enlace: "https://app.ejemplo.com/obligaciones",
        },
      ],
    });

    expect(plantilla.asunto).toContain("2 vencimiento(s)");
    expect(plantilla.texto).toContain("SOAT");
  });
});

describe("ProgramarAvisos (RF-53, §10.1)", () => {
  it("programa un aviso por canal y por día de anticipación", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5, 1]);

    const resultado = await contexto.programar.ejecutar({ configuracion: CONFIGURACION });

    // El vencimiento es en 5 días: entran los dos días de aviso, por dos canales.
    expect(resultado.programados).toBe(4);
    expect(resultado.omitidos).toBe(0);
  });

  it("es idempotente: correrla dos veces no duplica avisos", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5]);

    const primera = await contexto.programar.ejecutar({ configuracion: CONFIGURACION });
    const segunda = await contexto.programar.ejecutar({ configuracion: CONFIGURACION });

    expect(primera.programados).toBe(2);
    expect(segunda.programados).toBe(0);
    expect(segunda.omitidos).toBe(2);
  });

  it("no programa un aviso cuyo instante ya pasó", async () => {
    const contexto = montar();
    // Vence mañana: el aviso de 5 días antes habría tocado hace cuatro.
    await conObligacion(contexto, "2026-07-31", [5, 1]);

    const resultado = await contexto.programar.ejecutar({ configuracion: CONFIGURACION });

    expect(resultado.programados).toBe(2);
  });

  it("sin correo configurado no se programa el canal email (RF-102)", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [1]);

    const resultado = await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, emailDestino: null },
    });

    expect(resultado.programados).toBe(1);
    const filas = await contexto.listar.ejecutar({});
    expect(filas.every((f) => f.canal === "in_app")).toBe(true);
  });

  it("sin canales activos no hace nada", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [1]);

    const resultado = await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: [] },
    });

    expect(resultado).toEqual({ programados: 0, omitidos: 0 });
  });

  it("usa los días de aviso de la instalación si la obligación no los declara", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", []);

    const resultado = await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["in_app"], diasAviso: [3] },
    });

    expect(resultado.programados).toBe(1);
  });

  it("el resumen semanal se programa una sola vez y solo con correo", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [1]);

    const primera = await contexto.programar.programarResumen({ configuracion: CONFIGURACION });
    const segunda = await contexto.programar.programarResumen({ configuracion: CONFIGURACION });
    const sinCorreo = await contexto.programar.programarResumen({
      configuracion: { ...CONFIGURACION, emailDestino: null },
    });

    expect(primera.programado).toBe(true);
    expect(segunda.programado).toBe(false);
    expect(sinCorreo.programado).toBe(false);
  });
});

describe("EnviarNotificaciones (§10.1)", () => {
  it("envía las vencidas y las marca enviadas", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-07-31", [1]);
    await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["email"] },
    });

    const resultado = await contexto.enviar.ejecutar({ emailDestino: "dueno@ejemplo.com" });

    expect(resultado.enviadas).toBe(1);
    expect(contexto.email.enviados[0]?.para).toBe("dueno@ejemplo.com");
    const filas = await contexto.listar.ejecutar({});
    expect(filas[0]?.estado).toBe("enviada");
  });

  it("no envía dos veces la misma notificación", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-07-31", [1]);
    await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["email"] },
    });
    await contexto.enviar.ejecutar({ emailDestino: "dueno@ejemplo.com" });

    const segunda = await contexto.enviar.ejecutar({ emailDestino: "dueno@ejemplo.com" });

    expect(segunda.enviadas).toBe(0);
    expect(contexto.email.enviados).toHaveLength(1);
  });

  it("reintenta al fallar y cancela al tercer intento", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-07-31", [1]);
    await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["email"] },
    });
    contexto.email.falla = true;

    for (let i = 0; i < INTENTOS_MAXIMOS; i += 1) {
      await contexto.enviar.ejecutar({ emailDestino: "dueno@ejemplo.com" });
    }

    const filas = await contexto.listar.ejecutar({});
    expect(filas[0]?.intentos).toBe(INTENTOS_MAXIMOS);
    expect(filas[0]?.estado).toBe("cancelada");
    expect(filas[0]?.error).toContain("proveedor no disponible");

    // Cancelada deja de entrar en la cola.
    const posterior = await contexto.enviar.ejecutar({ emailDestino: "dueno@ejemplo.com" });
    expect(posterior.enviadas + posterior.fallidas).toBe(0);
  });

  it("sin destinatario las de correo quedan en la cola, no fallidas", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-07-31", [1]);
    await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["email"] },
    });

    const resultado = await contexto.enviar.ejecutar({ emailDestino: null });

    expect(resultado).toMatchObject({ enviadas: 0, fallidas: 0, omitidas: 1 });
    expect((await contexto.listar.ejecutar({}))[0]?.estado).toBe("programada");
  });

  it("las in_app se marcan enviadas sin proveedor", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-07-31", [1]);
    await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["in_app"] },
    });

    const resultado = await contexto.enviar.ejecutar({ emailDestino: null });

    expect(resultado.enviadas).toBe(1);
    expect(contexto.email.enviados).toHaveLength(0);
  });
});
