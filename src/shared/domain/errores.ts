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
    super(`${entidad.toUpperCase()}_NO_ENCONTRADO`, `No se encontro ${entidad} con id ${id}.`);
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
