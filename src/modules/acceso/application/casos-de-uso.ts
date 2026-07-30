import { ErrorDeDominio, NoAutorizado } from "@/shared/domain/errores";
import type { Reloj } from "@/shared/domain/reloj";

import { ControlDeIntentos } from "../domain/control-intentos";
import {
  DURACION_SESION_SEGUNDOS,
  firmarSesion,
  tokenCoincide,
  verificarSesion,
} from "../domain/sesion-firmada";
import type { Ajustes, AjustesRepository, AlmacenSesion, CredencialAcceso } from "../domain/sesion";

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

/** RF-03: ajustes de la instalacion (moneda y zona horaria de negocio). */
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

    return this.ajustes.actualizar({
      ...datos,
      ...(datos.moneda === undefined ? {} : { moneda: datos.moneda.toUpperCase() }),
    });
  }
}
