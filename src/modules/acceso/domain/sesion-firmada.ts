/**
 * Sesion firmada del acceso monousuario (Contexto.md §9, ADR-15).
 *
 * Este archivo no importa NADA a proposito: usa solo Web Crypto y las funciones
 * globales de codificacion, disponibles tanto en Node como en el runtime Edge.
 * Asi el dominio sigue siendo puro y el middleware —que corre en Edge y no puede
 * cargar `node:crypto`— reutiliza exactamente la misma verificacion que el
 * servidor. Una sola implementacion, ningun riesgo de que divergan.
 */

const TEXTO = new TextEncoder();

/** Vigencia de la cookie de sesion: 30 dias. */
export const DURACION_SESION_SEGUNDOS = 60 * 60 * 24 * 30;

function aBase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function digestoHex(valor: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", TEXTO.encode(valor));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Comparacion sin fuga de tiempo. Solo se usa sobre cadenas de igual longitud
 * (digestos o firmas), asi que el retorno temprano por longitud no revela nada
 * del secreto: revela la longitud de un hash, que es constante.
 */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

/**
 * Compara el token recibido con el configurado. Se comparan los digestos, no las
 * cadenas: de ese modo el tiempo de comparacion no depende de cuantos caracteres
 * iniciales acerto quien lo intenta, ni de la longitud del token real.
 */
export async function tokenCoincide(esperado: string, recibido: string): Promise<boolean> {
  if (esperado === "" || recibido === "") return false;
  const [a, b] = await Promise.all([digestoHex(esperado), digestoHex(recibido)]);
  return igualesEnTiempoConstante(a, b);
}

/**
 * La clave de firma mezcla el secreto de sesion con el digesto del token
 * vigente. Consecuencia deseada: cambiar TOKEN_ACCESO invalida al instante todas
 * las cookies emitidas antes, sin tocar la base ni rotar el secreto.
 */
async function claveDeFirma(secreto: string, token: string): Promise<CryptoKey> {
  const material = `${secreto}:${await digestoHex(token)}`;
  return crypto.subtle.importKey(
    "raw",
    TEXTO.encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function firma(secreto: string, token: string, carga: string): Promise<string> {
  const clave = await claveDeFirma(secreto, token);
  return aBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", clave, TEXTO.encode(carga))));
}

/** Valor de la cookie: `<expiracion en segundos>.<HMAC>`. */
export async function firmarSesion(
  secreto: string,
  token: string,
  expiraEnSegundos: number,
): Promise<string> {
  const carga = String(Math.floor(expiraEnSegundos));
  return `${carga}.${await firma(secreto, token, carga)}`;
}

/**
 * Verifica la cookie. Primero la firma y solo despues la expiracion: nunca se
 * interpreta una carga que todavia no se ha demostrado autentica.
 */
export async function verificarSesion(
  secreto: string,
  token: string,
  cookie: string,
  ahoraEnSegundos: number,
): Promise<boolean> {
  const separador = cookie.lastIndexOf(".");
  if (separador <= 0) return false;

  const carga = cookie.slice(0, separador);
  const firmaRecibida = cookie.slice(separador + 1);

  if (!igualesEnTiempoConstante(await firma(secreto, token, carga), firmaRecibida)) {
    return false;
  }

  const expira = Number(carga);
  return Number.isSafeInteger(expira) && expira > ahoraEnSegundos;
}
