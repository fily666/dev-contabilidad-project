import { beforeEach, describe, expect, it } from "vitest";

import type { Reloj } from "@/shared/domain/reloj";

import { ControlDeIntentos } from "../domain/control-intentos";
import { verificarSesion } from "../domain/sesion-firmada";
import type { AlmacenSesion, CredencialAcceso } from "../domain/sesion";
import { CerrarSesion, IniciarSesion, VerificarSesion } from "./casos-de-uso";

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
