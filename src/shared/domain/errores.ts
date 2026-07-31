/**
 * Errores de dominio con codigo estable. Contexto.md §8.6.
 *
 * El codigo viaja hasta la presentacion, que lo traduce a un mensaje en
 * espanol. Nunca se expone el detalle tecnico al usuario final.
 */
export class ErrorDeDominio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
    /** Campo del formulario al que corresponde el error, si aplica. */
    readonly campo?: string,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class NoEncontrado extends ErrorDeDominio {
  constructor(entidad: string, id: string) {
    // Los nombres de entidad con espacios («metodo de pago») generaban codigos
    // con espacios, que ninguna clave de MENSAJE_ERROR podia igualar: el usuario
    // veia el texto crudo del dominio en lugar del mensaje traducido (§8.6).
    const clave = entidad.trim().toUpperCase().replace(/\s+/g, "_");
    super(`${clave}_NO_ENCONTRADO`, `No se encontro ${entidad} con id ${id}.`);
  }
}

export class NoAutorizado extends ErrorDeDominio {
  constructor(mensaje = "No tienes permiso sobre este registro.") {
    super("NO_AUTORIZADO", mensaje);
  }
}

export class ReglaDeNegocioViolada extends ErrorDeDominio {
  constructor(codigo: string, mensaje: string, campo?: string) {
    super(codigo, mensaje, campo);
  }
}

export function esErrorDeDominio(error: unknown): error is ErrorDeDominio {
  return error instanceof ErrorDeDominio;
}
