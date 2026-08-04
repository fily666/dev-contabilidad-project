import { ErrorDeDominio, NoAutorizado } from "@/shared/domain/errores";
import type { Reloj } from "@/shared/domain/reloj";

import { ControlDeIntentos } from "../domain/control-intentos";
import {
  DURACION_SESION_SEGUNDOS,
  firmarSesion,
  tokenCoincide,
  verificarSesion,
} from "../domain/sesion-firmada";
import {
  FORMATOS_FECHA,
  HORIZONTE_PROYECCION_MAXIMO,
  HORIZONTE_PROYECCION_MINIMO,
  type Ajustes,
  type AjustesRepository,
  type AlmacenSesion,
  type CredencialAcceso,
  type FormatoFecha,
} from "../domain/sesion";

function enSegundos(reloj: Reloj): number {
  return Math.floor(reloj.ahora().getTime() / 1000);
}

/** RF-01: entrar con el token configurado. */
export class IniciarSesion {
  constructor(
    private readonly credencial: CredencialAcceso,
    private readonly almacen: AlmacenSesion,
    private readonly intentos: ControlDeIntentos,
    private readonly reloj: Reloj,
  ) {}

  /**
   * `origen` identifica a quien intenta entrar (la IP del request) para poder
   * frenar la fuerza bruta sin castigar a nadie mas.
   */
  async ejecutar(tokenRecibido: string, origen: string): Promise<void> {
    const ahora = enSegundos(this.reloj);

    const espera = this.intentos.segundosDeBloqueo(origen, ahora);
    if (espera > 0) {
      throw new ErrorDeDominio(
        "DEMASIADOS_INTENTOS",
        `Demasiados intentos fallidos. Vuelve a intentarlo en ${Math.ceil(espera / 60)} minuto(s).`,
        "token",
      );
    }

    if (!(await tokenCoincide(this.credencial.token(), tokenRecibido))) {
      this.intentos.registrarFallo(origen, ahora);
      throw new ErrorDeDominio("TOKEN_INVALIDO", "El token de acceso no es correcto.", "token");
    }

    this.intentos.limpiar(origen);

    const cookie = await firmarSesion(
      this.credencial.secretoSesion(),
      this.credencial.token(),
      ahora + DURACION_SESION_SEGUNDOS,
    );
    await this.almacen.escribir(cookie, DURACION_SESION_SEGUNDOS);
  }
}

/** RF-04: salir. */
export class CerrarSesion {
  constructor(private readonly almacen: AlmacenSesion) {}

  async ejecutar(): Promise<void> {
    await this.almacen.borrar();
  }
}

/** Comprueba que haya una sesion vigente. Base de toda operacion privada (§9). */
export class VerificarSesion {
  constructor(
    private readonly credencial: CredencialAcceso,
    private readonly almacen: AlmacenSesion,
    private readonly reloj: Reloj,
  ) {}

  async haySesion(): Promise<boolean> {
    const cookie = await this.almacen.leer();
    if (!cookie) return false;

    return verificarSesion(
      this.credencial.secretoSesion(),
      this.credencial.token(),
      cookie,
      enSegundos(this.reloj),
    );
  }

  async exigirSesion(): Promise<void> {
    if (!(await this.haySesion())) {
      throw new NoAutorizado("Tu sesión expiró. Vuelve a ingresar con el token de acceso.");
    }
  }
}

/**
 * RF-03 y RF-101: preferencias de la instalacion (moneda, zona horaria de
 * negocio, formato de fecha y horizonte de proyeccion).
 */
export class ActualizarAjustes {
  constructor(private readonly ajustes: AjustesRepository) {}

  async ejecutar(datos: Partial<Ajustes>): Promise<Ajustes> {
    if (datos.moneda !== undefined && !/^[A-Za-z]{3}$/.test(datos.moneda)) {
      throw new ErrorDeDominio(
        "MONEDA_INVALIDA",
        "Usa el código ISO de tres letras, por ejemplo COP.",
        "moneda",
      );
    }

    if (
      datos.formatoFecha !== undefined &&
      !FORMATOS_FECHA.includes(datos.formatoFecha as FormatoFecha)
    ) {
      throw new ErrorDeDominio(
        "FORMATO_FECHA_INVALIDO",
        "El formato de fecha no está entre los disponibles.",
        "formatoFecha",
      );
    }

    // RF-102: el correo es la unica preferencia con formato que validar; los
    // canales y los dias ya llegan acotados por el esquema y por el adaptador.
    if (
      datos.emailDestino !== undefined &&
      datos.emailDestino !== null &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.emailDestino)
    ) {
      throw new ErrorDeDominio(
        "EMAIL_INVALIDO",
        "El correo de notificaciones no es válido.",
        "emailDestino",
      );
    }

    // RF-102, §17 P-3: mismo tratamiento que el correo, en formato E.164.
    if (
      datos.whatsappDestino !== undefined &&
      datos.whatsappDestino !== null &&
      !/^\+[1-9]\d{7,14}$/.test(datos.whatsappDestino)
    ) {
      throw new ErrorDeDominio(
        "WHATSAPP_INVALIDO",
        "El número de WhatsApp debe estar en formato internacional, por ejemplo +573001234567.",
        "whatsappDestino",
      );
    }

    const horizonte = datos.horizonteProyeccionMeses;
    if (
      horizonte !== undefined &&
      (!Number.isInteger(horizonte) ||
        horizonte < HORIZONTE_PROYECCION_MINIMO ||
        horizonte > HORIZONTE_PROYECCION_MAXIMO)
    ) {
      throw new ErrorDeDominio(
        "HORIZONTE_INVALIDO",
        `El horizonte de proyección debe ser un número entero entre ${HORIZONTE_PROYECCION_MINIMO} y ${HORIZONTE_PROYECCION_MAXIMO} meses.`,
        "horizonteProyeccionMeses",
      );
    }

    return this.ajustes.actualizar({
      ...datos,
      ...(datos.moneda === undefined ? {} : { moneda: datos.moneda.toUpperCase() }),
    });
  }
}
