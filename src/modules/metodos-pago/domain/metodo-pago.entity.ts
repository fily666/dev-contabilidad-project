import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { TIPOS_METODO_PAGO, type TipoMetodoPago } from "@/shared/domain/enumeraciones";

export type DatosMetodoPago = {
  id: string;
  nombre: string;
  tipo: TipoMetodoPago;
  ultimosDigitos: string | null;
  activo: boolean;
};

const LARGO_MAXIMO_NOMBRE = 60;

/**
 * Metodo de pago del catalogo administrable (Contexto.md RF-33).
 *
 * Las reglas viven aqui y no en la Server Action ni en el caso de uso (§7.4):
 * el nombre acotado y el formato de los ultimos digitos son invariantes de la
 * entidad, y coinciden con los `check` de la tabla (§6.3), que es la ultima
 * linea de defensa (§8.7).
 */
export class MetodoPago {
  private constructor(private datos: DatosMetodoPago) {}

  static crear(entrada: {
    id: string;
    nombre: string;
    tipo: TipoMetodoPago;
    ultimosDigitos?: string | null;
  }): MetodoPago {
    return new MetodoPago({
      id: entrada.id,
      nombre: exigirNombre(entrada.nombre),
      tipo: exigirTipo(entrada.tipo),
      ultimosDigitos: exigirUltimosDigitos(entrada.ultimosDigitos),
      activo: true,
    });
  }

  static desdePersistencia(datos: DatosMetodoPago): MetodoPago {
    return new MetodoPago(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get nombre(): string {
    return this.datos.nombre;
  }
  get tipo(): TipoMetodoPago {
    return this.datos.tipo;
  }
  get ultimosDigitos(): string | null {
    return this.datos.ultimosDigitos;
  }
  get activo(): boolean {
    return this.datos.activo;
  }

  renombrar(nombre: string): void {
    this.datos.nombre = exigirNombre(nombre);
  }

  cambiarTipo(tipo: TipoMetodoPago): void {
    this.datos.tipo = exigirTipo(tipo);
  }

  cambiarUltimosDigitos(valor: string | null | undefined): void {
    this.datos.ultimosDigitos = exigirUltimosDigitos(valor);
  }

  activar(): void {
    this.datos.activo = true;
  }

  /** RF-33: un metodo en uso se desactiva; nunca se elimina (§5.7.8, ADR-12). */
  desactivar(): void {
    this.datos.activo = false;
  }

  aDatos(): DatosMetodoPago {
    return { ...this.datos };
  }
}

function exigirNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length < 1 || limpio.length > LARGO_MAXIMO_NOMBRE) {
    throw new ReglaDeNegocioViolada(
      "NOMBRE_INVALIDO",
      `El nombre del metodo de pago debe tener entre 1 y ${LARGO_MAXIMO_NOMBRE} caracteres.`,
      "nombre",
    );
  }
  return limpio;
}

function exigirTipo(tipo: TipoMetodoPago): TipoMetodoPago {
  if (!TIPOS_METODO_PAGO.includes(tipo)) {
    throw new ReglaDeNegocioViolada(
      "TIPO_METODO_PAGO_INVALIDO",
      "El tipo de metodo de pago no esta en el catalogo.",
      "tipo",
    );
  }
  return tipo;
}

/**
 * Los ultimos digitos son opcionales, pero si vienen deben ser 2 a 4 cifras:
 * es la misma expresion del `check` de la tabla, para que el rechazo ocurra en
 * el dominio y no como error de base de datos.
 */
function exigirUltimosDigitos(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  if (!limpio) return null;

  if (!/^[0-9]{2,4}$/.test(limpio)) {
    throw new ReglaDeNegocioViolada(
      "ULTIMOS_DIGITOS_INVALIDOS",
      "Los ultimos digitos deben ser entre 2 y 4 cifras.",
      "ultimosDigitos",
    );
  }
  return limpio;
}
