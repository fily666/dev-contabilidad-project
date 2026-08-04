import { beforeEach, describe, expect, it } from "vitest";

import type { Reloj } from "@/shared/domain/reloj";

import { ControlDeIntentos } from "../domain/control-intentos";
import { verificarSesion } from "../domain/sesion-firmada";
import {
  AJUSTES_POR_OMISION,
  type Ajustes,
  type AjustesRepository,
  type AlmacenSesion,
  type CredencialAcceso,
} from "../domain/sesion";
import { ActualizarAjustes, CerrarSesion, IniciarSesion, VerificarSesion } from "./casos-de-uso";

const TOKEN = "Admin123!";
const SECRETO = "un-secreto-de-al-menos-32-caracteres-aqui";

const credencial: CredencialAcceso = {
  token: () => TOKEN,
  secretoSesion: () => SECRETO,
};

/** Reloj fijo: los vencimientos de sesion son verificables (§7.3). */
function relojFijo(instante = new Date("2026-07-30T10:00:00Z")): Reloj {
  return { ahora: () => instante, hoy: () => instante.toISOString().slice(0, 10) };
}

function almacenEnMemoria(): AlmacenSesion & { valor: string | null } {
  return {
    valor: null,
    async leer() {
      return this.valor;
    },
    async escribir(valor: string) {
      this.valor = valor;
    },
    async borrar() {
      this.valor = null;
    },
  };
}

describe("IniciarSesion", () => {
  let almacen: ReturnType<typeof almacenEnMemoria>;
  let intentos: ControlDeIntentos;
  let iniciar: IniciarSesion;

  beforeEach(() => {
    almacen = almacenEnMemoria();
    intentos = new ControlDeIntentos(3, 300);
    iniciar = new IniciarSesion(credencial, almacen, intentos, relojFijo());
  });

  it("con el token correcto deja una sesion verificable", async () => {
    await iniciar.ejecutar(TOKEN, "1.2.3.4");

    expect(almacen.valor).not.toBeNull();
    const ahora = Math.floor(relojFijo().ahora().getTime() / 1000);
    await expect(verificarSesion(SECRETO, TOKEN, almacen.valor!, ahora)).resolves.toBe(true);
  });

  it("con el token equivocado falla y no deja sesion", async () => {
    await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow(/no es correcto/i);
    expect(almacen.valor).toBeNull();
  });

  it("bloquea tras los intentos configurados", async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow(/no es correcto/i);
    }

    // El cuarto intento ya no discute el token: rechaza por bloqueo.
    await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow(/Demasiados intentos/i);
  });

  /**
   * Importa que el bloqueo aplique tambien al token correcto: si no, un atacante
   * sabria que acerto porque el mensaje cambiaria, y el freno no serviria de nada.
   */
  it("el bloqueo tambien rechaza el token correcto", async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow();
    }

    await expect(iniciar.ejecutar(TOKEN, "1.2.3.4")).rejects.toThrow(/Demasiados intentos/i);
    expect(almacen.valor).toBeNull();
  });

  it("no bloquea a otro origen", async () => {
    for (let i = 0; i < 3; i += 1) {
      await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow();
    }

    await expect(iniciar.ejecutar(TOKEN, "9.9.9.9")).resolves.toBeUndefined();
  });

  it("un acierto limpia los fallos previos del mismo origen", async () => {
    await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow();
    await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow();
    await iniciar.ejecutar(TOKEN, "1.2.3.4");

    await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow(/no es correcto/i);
    await expect(iniciar.ejecutar("otro", "1.2.3.4")).rejects.toThrow(/no es correcto/i);
  });
});

describe("VerificarSesion", () => {
  it("no hay sesion cuando el almacen esta vacio", async () => {
    const verificar = new VerificarSesion(credencial, almacenEnMemoria(), relojFijo());
    await expect(verificar.haySesion()).resolves.toBe(false);
    await expect(verificar.exigirSesion()).rejects.toThrow(/sesión expiró/i);
  });

  it("reconoce la sesion que acaba de abrir IniciarSesion", async () => {
    const almacen = almacenEnMemoria();
    const reloj = relojFijo();
    await new IniciarSesion(credencial, almacen, new ControlDeIntentos(), reloj).ejecutar(
      TOKEN,
      "1.2.3.4",
    );

    const verificar = new VerificarSesion(credencial, almacen, reloj);
    await expect(verificar.haySesion()).resolves.toBe(true);
    await expect(verificar.exigirSesion()).resolves.toBeUndefined();
  });

  it("la sesion caduca al pasar su vigencia", async () => {
    const almacen = almacenEnMemoria();
    await new IniciarSesion(credencial, almacen, new ControlDeIntentos(), relojFijo()).ejecutar(
      TOKEN,
      "1.2.3.4",
    );

    const dentroDeUnAno = relojFijo(new Date("2027-07-30T10:00:00Z"));
    const verificar = new VerificarSesion(credencial, almacen, dentroDeUnAno);
    await expect(verificar.haySesion()).resolves.toBe(false);
  });

  /** Rotar el token debe cerrar lo que ya estaba abierto, no solo lo nuevo. */
  it("cambiar el token invalida la sesion en curso", async () => {
    const almacen = almacenEnMemoria();
    const reloj = relojFijo();
    await new IniciarSesion(credencial, almacen, new ControlDeIntentos(), reloj).ejecutar(
      TOKEN,
      "1.2.3.4",
    );

    const rotada: CredencialAcceso = {
      token: () => "TokenNuevoYMuchoMasLargo9$",
      secretoSesion: () => SECRETO,
    };
    await expect(new VerificarSesion(rotada, almacen, reloj).haySesion()).resolves.toBe(false);
  });
});

describe("CerrarSesion", () => {
  it("borra la sesion del almacen", async () => {
    const almacen = almacenEnMemoria();
    const reloj = relojFijo();
    await new IniciarSesion(credencial, almacen, new ControlDeIntentos(), reloj).ejecutar(
      TOKEN,
      "1.2.3.4",
    );

    await new CerrarSesion(almacen).ejecutar();

    expect(almacen.valor).toBeNull();
    await expect(new VerificarSesion(credencial, almacen, reloj).haySesion()).resolves.toBe(false);
  });
});

function ajustesEnMemoria(inicial: Ajustes = AJUSTES_POR_OMISION): AjustesRepository & {
  guardados: Ajustes;
} {
  return {
    guardados: { ...inicial },
    async obtener() {
      return this.guardados;
    },
    async actualizar(datos: Partial<Ajustes>) {
      this.guardados = { ...this.guardados, ...datos };
      return this.guardados;
    },
  };
}

describe("ActualizarAjustes (RF-03, RF-101)", () => {
  it("guarda moneda, zona horaria, formato de fecha y horizonte", async () => {
    const repositorio = ajustesEnMemoria();

    const ajustes = await new ActualizarAjustes(repositorio).ejecutar({
      moneda: "usd",
      zonaHoraria: "America/Lima",
      formatoFecha: "dd/MM/yyyy",
      horizonteProyeccionMeses: 24,
    });

    expect(ajustes).toEqual({
      moneda: "USD", // se normaliza a mayusculas
      zonaHoraria: "America/Lima",
      formatoFecha: "dd/MM/yyyy",
      horizonteProyeccionMeses: 24,
      // RF-102: lo que no viaja en la actualizacion conserva su valor.
      canalesNotificacion: ["in_app"],
      diasAvisoPorOmision: [5, 1],
      emailDestino: null,
      whatsappDestino: null,
    });
  });

  it("rechaza una moneda que no es codigo ISO de tres letras", async () => {
    const caso = new ActualizarAjustes(ajustesEnMemoria());
    await expect(caso.ejecutar({ moneda: "PESOS" })).rejects.toMatchObject({
      codigo: "MONEDA_INVALIDA",
      campo: "moneda",
    });
  });

  it("rechaza un formato de fecha que no esta en el catalogo", async () => {
    const caso = new ActualizarAjustes(ajustesEnMemoria());
    await expect(
      caso.ejecutar({ formatoFecha: "MM-DD-YY" as Ajustes["formatoFecha"] }),
    ).rejects.toMatchObject({ codigo: "FORMATO_FECHA_INVALIDO", campo: "formatoFecha" });
  });

  it.each([0, -3, 61, 12.5])("rechaza el horizonte %s meses", async (horizonte) => {
    const caso = new ActualizarAjustes(ajustesEnMemoria());
    await expect(caso.ejecutar({ horizonteProyeccionMeses: horizonte })).rejects.toMatchObject({
      codigo: "HORIZONTE_INVALIDO",
      campo: "horizonteProyeccionMeses",
    });
  });

  it("una actualizacion parcial no pisa las demas preferencias", async () => {
    const repositorio = ajustesEnMemoria();

    await new ActualizarAjustes(repositorio).ejecutar({ horizonteProyeccionMeses: 36 });

    expect(repositorio.guardados).toEqual({
      ...AJUSTES_POR_OMISION,
      horizonteProyeccionMeses: 36,
    });
  });
});
