import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";
import type { EstadoProyecto } from "@/shared/domain/enumeraciones";
import type { TipoProyecto, ValorAtributo } from "./tipo-proyecto.entity";

export type DatosProyecto = {
  id: string;
  tipoProyectoId: string;
  nombre: string;
  descripcion: string | null;
  fechaInicio: FechaIso;
  fechaFin: FechaIso | null;
  estado: EstadoProyecto;
  moneda: string;
  atributos: Record<string, ValorAtributo>;
};

export type EntradaCrearProyecto = {
  id: string;
  tipo: TipoProyecto;
  nombre: string;
  descripcion?: string | null;
  fechaInicio: FechaIso;
  fechaFin?: FechaIso | null;
  moneda?: string;
  atributos?: Record<string, unknown>;
};

export type EntradaActualizarProyecto = {
  tipo: TipoProyecto;
  nombre: string;
  descripcion?: string | null;
  fechaInicio: FechaIso;
  fechaFin?: FechaIso | null;
  atributos?: Record<string, unknown>;
};

/**
 * Proyecto: unidad financiera independiente (Contexto.md §2).
 * Concentra las invariantes de §5.7 que le corresponden.
 */
export class Proyecto {
  private constructor(private datos: DatosProyecto) {}

  static crear(entrada: EntradaCrearProyecto): Proyecto {
    const nombre = normalizarNombre(entrada.nombre);
    validarFechas(entrada.fechaInicio, entrada.fechaFin ?? null);

    return new Proyecto({
      id: entrada.id,
      tipoProyectoId: entrada.tipo.id,
      nombre,
      descripcion: normalizarTexto(entrada.descripcion),
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin ?? null,
      estado: "activo",
      moneda: (entrada.moneda ?? "COP").toUpperCase(),
      atributos: entrada.tipo.validarAtributos(entrada.atributos ?? {}),
    });
  }

  static desdePersistencia(datos: DatosProyecto): Proyecto {
    return new Proyecto(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get tipoProyectoId(): string {
    return this.datos.tipoProyectoId;
  }
  get nombre(): string {
    return this.datos.nombre;
  }
  get descripcion(): string | null {
    return this.datos.descripcion;
  }
  get fechaInicio(): FechaIso {
    return this.datos.fechaInicio;
  }
  get fechaFin(): FechaIso | null {
    return this.datos.fechaFin;
  }
  get estado(): EstadoProyecto {
    return this.datos.estado;
  }
  get moneda(): string {
    return this.datos.moneda;
  }
  get atributos(): Record<string, ValorAtributo> {
    return { ...this.datos.atributos };
  }

  /** Invariante §5.7.7: un proyecto cerrado no acepta movimientos nuevos. */
  aceptaMovimientos(): boolean {
    return this.estado === "activo" || this.estado === "pausado";
  }

  actualizar(entrada: EntradaActualizarProyecto): void {
    if (!this.aceptaMovimientos() && this.estado === "archivado") {
      throw new ReglaDeNegocioViolada(
        "PROYECTO_ARCHIVADO",
        "Reactiva el proyecto antes de editarlo.",
      );
    }
    validarFechas(entrada.fechaInicio, entrada.fechaFin ?? null);

    this.datos = {
      ...this.datos,
      tipoProyectoId: entrada.tipo.id,
      nombre: normalizarNombre(entrada.nombre),
      descripcion: normalizarTexto(entrada.descripcion),
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin ?? null,
      atributos: entrada.tipo.validarAtributos(entrada.atributos ?? {}),
    };
  }

  cambiarEstado(nuevo: EstadoProyecto, hoy: FechaIso): void {
    if (nuevo === this.estado) return;

    if (nuevo === "finalizado" && this.datos.fechaFin === null) {
      this.datos.fechaFin = hoy;
    }
    if ((nuevo === "activo" || nuevo === "pausado") && this.datos.estado === "finalizado") {
      this.datos.fechaFin = null;
    }
    this.datos.estado = nuevo;
  }

  aDatos(): DatosProyecto {
    return { ...this.datos, atributos: { ...this.datos.atributos } };
  }
}

function normalizarNombre(valor: string): string {
  const nombre = valor.trim();
  if (nombre.length < 1 || nombre.length > 120) {
    throw new ReglaDeNegocioViolada(
      "NOMBRE_INVALIDO",
      "El nombre del proyecto debe tener entre 1 y 120 caracteres.",
      "nombre",
    );
  }
  return nombre;
}

function normalizarTexto(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}

function validarFechas(inicio: FechaIso, fin: FechaIso | null): void {
  if (!esFechaIso(inicio)) {
    throw new ReglaDeNegocioViolada(
      "FECHA_INVALIDA",
      "La fecha de inicio no es valida.",
      "fechaInicio",
    );
  }
  if (fin !== null) {
    if (!esFechaIso(fin)) {
      throw new ReglaDeNegocioViolada(
        "FECHA_INVALIDA",
        "La fecha de cierre no es valida.",
        "fechaFin",
      );
    }
    if (fin < inicio) {
      throw new ReglaDeNegocioViolada(
        "FECHAS_INCOHERENTES",
        "La fecha de cierre no puede ser anterior a la fecha de inicio.",
        "fechaFin",
      );
    }
  }
}
