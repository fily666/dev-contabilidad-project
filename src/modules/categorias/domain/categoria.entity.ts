import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Naturaleza, TipoMovimiento } from "@/shared/domain/enumeraciones";
import { naturalezaEsCompatible } from "@/shared/domain/enumeraciones";

export type DatosCategoria = {
  id: string;
  propietarioId: string | null;
  tipoProyectoId: string | null;
  padreId: string | null;
  nombre: string;
  naturaleza: Naturaleza;
  esSistema: boolean;
  activa: boolean;
  orden: number;
};

/**
 * Categoria de movimiento. Declara su naturaleza economica, que es lo que
 * permite separar inversion de gasto (Contexto.md RF-32, ADR-06).
 */
export class Categoria {
  private constructor(private datos: DatosCategoria) {}

  static crear(entrada: {
    id: string;
    propietarioId: string;
    tipoProyectoId?: string | null;
    padreId?: string | null;
    nombre: string;
    naturaleza: Naturaleza;
    orden?: number;
  }): Categoria {
    const nombre = entrada.nombre.trim();
    if (nombre.length < 1 || nombre.length > 80) {
      throw new ReglaDeNegocioViolada(
        "NOMBRE_INVALIDO",
        "El nombre de la categoria debe tener entre 1 y 80 caracteres.",
        "nombre",
      );
    }

    return new Categoria({
      id: entrada.id,
      propietarioId: entrada.propietarioId,
      tipoProyectoId: entrada.tipoProyectoId ?? null,
      padreId: entrada.padreId ?? null,
      nombre,
      naturaleza: entrada.naturaleza,
      esSistema: false,
      activa: true,
      orden: entrada.orden ?? 0,
    });
  }

  static desdePersistencia(datos: DatosCategoria): Categoria {
    return new Categoria(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get propietarioId(): string | null {
    return this.datos.propietarioId;
  }
  get tipoProyectoId(): string | null {
    return this.datos.tipoProyectoId;
  }
  get padreId(): string | null {
    return this.datos.padreId;
  }
  get nombre(): string {
    return this.datos.nombre;
  }
  get naturaleza(): Naturaleza {
    return this.datos.naturaleza;
  }
  get esSistema(): boolean {
    return this.datos.esSistema;
  }
  get activa(): boolean {
    return this.datos.activa;
  }
  get orden(): number {
    return this.datos.orden;
  }
  get esRaiz(): boolean {
    return this.datos.padreId === null;
  }

  /** Tipo de movimiento que admite esta categoria. */
  get tipoImplicito(): TipoMovimiento {
    return this.datos.naturaleza === "ingreso" ? "ingreso" : "egreso";
  }

  /** Invariante §5.7.3. */
  admiteTipo(tipo: TipoMovimiento): boolean {
    return naturalezaEsCompatible(tipo, this.datos.naturaleza);
  }

  renombrar(nombre: string): void {
    this.exigirEditable();
    const limpio = nombre.trim();
    if (limpio.length < 1 || limpio.length > 80) {
      throw new ReglaDeNegocioViolada(
        "NOMBRE_INVALIDO",
        "El nombre de la categoria debe tener entre 1 y 80 caracteres.",
        "nombre",
      );
    }
    this.datos.nombre = limpio;
  }

  cambiarNaturaleza(naturaleza: Naturaleza): void {
    this.exigirEditable();
    this.datos.naturaleza = naturaleza;
  }

  activar(): void {
    this.datos.activa = true;
  }

  /** RF-34: las categorias del sistema se ocultan, no se eliminan. */
  desactivar(): void {
    this.datos.activa = false;
  }

  aDatos(): DatosCategoria {
    return { ...this.datos };
  }

  private exigirEditable(): void {
    if (this.datos.esSistema) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_DEL_SISTEMA",
        "Las categorias del sistema no se pueden modificar; puedes ocultarlas.",
      );
    }
  }
}
