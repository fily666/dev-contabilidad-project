import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";
import { ObligacionRepositoryEnMemoria } from "@/modules/obligaciones/application/dobles";
import { Obligacion } from "@/modules/obligaciones/domain/obligacion.entity";

import { INTENTOS_MAXIMOS } from "../domain/notificacion.entity";
import { plantillaAviso, plantillaResumen } from "../domain/plantillas";
import {
  EnviarNotificaciones,
  ListarNotificaciones,
  MarcarAvisoLeido,
  MarcarAvisosLeidos,
  ObtenerBandejaAvisos,
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
    bandeja: new ObtenerBandejaAvisos(notificaciones, reloj),
    marcarLeido: new MarcarAvisoLeido(notificaciones, reloj),
    marcarTodos: new MarcarAvisosLeidos(notificaciones, reloj),
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

/**
 * §10.2 y RF-59: el lado que faltaba del canal in-app. Era el último hueco
 * abierto de §17 —los avisos se escribían y nadie los leía—, así que estas
 * pruebas cubren el camino completo: qué muestra la campana, qué cuenta como no
 * leído y cuándo un aviso deja de aparecer.
 */
describe("Bandeja de avisos in-app (§10.2, RF-59)", () => {
  const SOLO_IN_APP: ConfiguracionAvisos = { ...CONFIGURACION, canales: ["in_app"] };

  it("muestra el aviso cuyo instante ya llegó y deja fuera el que aún no toca", async () => {
    const contexto = montar();
    // Vence en cinco días con avisos a 5 y 1: el de 5 cae hoy, el de 1 el día 3.
    await conObligacion(contexto, "2026-08-04", [5, 1]);
    const programados = await contexto.programar.ejecutar({ configuracion: SOLO_IN_APP });

    const bandeja = await contexto.bandeja.ejecutar();

    expect(programados.programados).toBe(2);
    expect(bandeja.avisos).toHaveLength(1);
    expect(bandeja.noLeidos).toBe(1);
    expect(bandeja.avisos[0]?.asunto).toContain("Cuota del crédito");
    // La campana muestra el texto, no el HTML del correo.
    expect(bandeja.avisos[0]?.cuerpo).not.toContain("<");
  });

  it("el aviso aparece sin esperar a la tarea horaria de envío", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5]);
    await contexto.programar.ejecutar({ configuracion: SOLO_IN_APP });

    // Sin pasar por `enviar`: sigue en `programada` y ya debe verse. Esperar a la
    // tarea lo retrasaría hasta una hora, que en un aviso es el defecto entero.
    const bandeja = await contexto.bandeja.ejecutar();

    expect(bandeja.avisos[0]?.estado).toBe("programada");
    expect(bandeja.noLeidos).toBe(1);
  });

  it("marcar leído baja el contador pero no borra el aviso", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5]);
    await contexto.programar.ejecutar({ configuracion: SOLO_IN_APP });
    const [aviso] = (await contexto.bandeja.ejecutar()).avisos;

    await contexto.marcarLeido.ejecutar({ id: aviso!.id });
    const despues = await contexto.bandeja.ejecutar();

    expect(despues.noLeidos).toBe(0);
    expect(despues.avisos).toHaveLength(1);
    expect(despues.avisos[0]?.leidaEn).not.toBeNull();
    expect((await contexto.bandeja.ejecutar({ soloNoLeidos: true })).avisos).toHaveLength(0);
  });

  it("volver a leer el mismo aviso no mueve el instante de lectura", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5]);
    await contexto.programar.ejecutar({ configuracion: SOLO_IN_APP });
    const [aviso] = (await contexto.bandeja.ejecutar()).avisos;

    await contexto.marcarLeido.ejecutar({ id: aviso!.id });
    const primera = (await contexto.bandeja.ejecutar()).avisos[0]?.leidaEn;
    contexto.reloj.viajarA("2026-08-01");
    await contexto.marcarLeido.ejecutar({ id: aviso!.id });

    expect((await contexto.bandeja.ejecutar()).avisos[0]?.leidaEn).toBe(primera);
  });

  it("marcar todo como leído deja el contador en cero y no repite trabajo", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5, 1]);
    await contexto.programar.ejecutar({ configuracion: SOLO_IN_APP });

    const primera = await contexto.marcarTodos.ejecutar();
    const segunda = await contexto.marcarTodos.ejecutar();

    // Solo uno estaba publicado: el aviso futuro no se puede leer antes de existir.
    expect(primera.leidos).toBe(1);
    expect(segunda.leidos).toBe(0);
    expect((await contexto.bandeja.ejecutar()).noLeidos).toBe(0);
  });

  it("el correo no entra en la bandeja ni admite marcarse leído", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-07-31", [1]);
    await contexto.programar.ejecutar({
      configuracion: { ...CONFIGURACION, canales: ["email"] },
    });
    const [correo] = await contexto.listar.ejecutar({});

    const bandeja = await contexto.bandeja.ejecutar();

    expect(bandeja.avisos).toHaveLength(0);
    expect(bandeja.noLeidos).toBe(0);
    await expect(contexto.marcarLeido.ejecutar({ id: correo!.id })).rejects.toMatchObject({
      codigo: "AVISO_NO_LEIBLE",
    });
  });

  it("cancelar los avisos de una ocurrencia los retira de la campana", async () => {
    const contexto = montar();
    await conObligacion(contexto, "2026-08-04", [5]);
    await contexto.programar.ejecutar({ configuracion: SOLO_IN_APP });
    const [aviso] = (await contexto.bandeja.ejecutar()).avisos;

    // Es lo que ocurre al pagar u omitir la ocurrencia (§10): el aviso deja de
    // tener sentido, y la campana se limpia sin código propio.
    await contexto.notificaciones.cancelarDeOcurrencia(aviso!.ocurrenciaId!);

    expect((await contexto.bandeja.ejecutar()).avisos).toHaveLength(0);
  });

  it("un aviso que no existe se rechaza con su código", async () => {
    const contexto = montar();

    await expect(
      contexto.marcarLeido.ejecutar({ id: "0a000000-0000-4000-8000-000000000999" }),
    ).rejects.toMatchObject({ codigo: "AVISO_NO_ENCONTRADO" });
  });
});
