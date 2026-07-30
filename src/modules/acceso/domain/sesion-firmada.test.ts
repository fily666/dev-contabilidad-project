import { describe, expect, it } from "vitest";

import {
  DURACION_SESION_SEGUNDOS,
  firmarSesion,
  tokenCoincide,
  verificarSesion,
} from "./sesion-firmada";

const SECRETO = "un-secreto-de-al-menos-32-caracteres-aqui";
const TOKEN = "Admin123!";
const AHORA = 1_800_000_000;

describe("tokenCoincide", () => {
  it("acepta el token exacto", async () => {
    await expect(tokenCoincide(TOKEN, TOKEN)).resolves.toBe(true);
  });

  it("rechaza uno distinto, aunque comparta el prefijo", async () => {
    await expect(tokenCoincide(TOKEN, "Admin123")).resolves.toBe(false);
    await expect(tokenCoincide(TOKEN, "Admin123!!")).resolves.toBe(false);
    await expect(tokenCoincide(TOKEN, "admin123!")).resolves.toBe(false);
  });

  it("rechaza la cadena vacia por ambos lados", async () => {
    await expect(tokenCoincide(TOKEN, "")).resolves.toBe(false);
    await expect(tokenCoincide("", "")).resolves.toBe(false);
  });
});

describe("sesion firmada", () => {
  it("verifica una cookie recien emitida", async () => {
    const cookie = await firmarSesion(SECRETO, TOKEN, AHORA + DURACION_SESION_SEGUNDOS);
    await expect(verificarSesion(SECRETO, TOKEN, cookie, AHORA)).resolves.toBe(true);
  });

  it("rechaza una cookie expirada", async () => {
    const cookie = await firmarSesion(SECRETO, TOKEN, AHORA - 1);
    await expect(verificarSesion(SECRETO, TOKEN, cookie, AHORA)).resolves.toBe(false);
  });

  it("rechaza una firma de otro secreto", async () => {
    const cookie = await firmarSesion("otro-secreto-igualmente-largo-de-32+", TOKEN, AHORA + 100);
    await expect(verificarSesion(SECRETO, TOKEN, cookie, AHORA)).resolves.toBe(false);
  });

  /**
   * Esta es la propiedad que justifica atar la clave de firma al token: rotar
   * TOKEN_ACCESO tiene que cerrar las sesiones abiertas, no solo impedir entradas
   * nuevas. Si no, quien tenga una cookie viva sigue dentro tras el cambio.
   */
  it("invalida las cookies emitidas con el token anterior", async () => {
    const cookie = await firmarSesion(SECRETO, TOKEN, AHORA + DURACION_SESION_SEGUNDOS);
    await expect(verificarSesion(SECRETO, "TokenNuevo9$", cookie, AHORA)).resolves.toBe(false);
  });

  it("rechaza una carga alterada aunque se conserve la firma", async () => {
    const cookie = await firmarSesion(SECRETO, TOKEN, AHORA + 60);
    const [, firma] = cookie.split(".");
    const falsificada = `${AHORA + 999_999}.${firma}`;
    await expect(verificarSesion(SECRETO, TOKEN, falsificada, AHORA)).resolves.toBe(false);
  });

  it("rechaza basura sin separador", async () => {
    await expect(verificarSesion(SECRETO, TOKEN, "cualquier-cosa", AHORA)).resolves.toBe(false);
    await expect(verificarSesion(SECRETO, TOKEN, "", AHORA)).resolves.toBe(false);
    await expect(verificarSesion(SECRETO, TOKEN, ".abc", AHORA)).resolves.toBe(false);
  });
});
