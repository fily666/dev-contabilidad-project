import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";

export type Periodicidad = "mensual" | "anual";

export type DatosPresupuesto = {
  id: string;
  /** `null` es presupuesto global, no de un proyecto (§6.3). */
  proyectoId: string | null;
  categoriaId: string;
  periodoInicio: FechaIso;
  periodoFin: FechaIso;
  valorPlaneado: number;
  notas: string | null;
};

/**
 * Presupuesto por proyecto, categoria y periodo (Contexto.md RF-80).
 *
 * El periodo se guarda como rango de fechas y no como «mes» o «año»: asi el
 * mismo registro sirve para los dos casos de RF-80 —y para un rango arbitrario
 * si algun dia hace falta— sin una columna de tipo que haya que interpretar.
 * El pendiente 5 de §17 preguntaba si mensual, anual o ambos: ambos, y sin
 * pagar por ello una segunda tabla.
 */
export class Presupuesto {
  private constructor(private datos: DatosPresupuesto) {}

  static crear(entrada: {
    id: string;
    proyectoId?: string | null;
    categoriaId: string;
    periodoInicio: FechaIso;
    periodoFin: FechaIso;
    valorPlaneado: number;
    notas?: string | null;
  }): Presupuesto {
    validarPeriodo(entrada.periodoInicio, entrada.periodoFin);

    return new Presupuesto({
      id: entrada.id,
      proyectoId: entrada.proyectoId ?? null,
      categoriaId: entrada.categoriaId,
      periodoInicio: entrada.periodoInicio,
      periodoFin: entrada.periodoFin,
      valorPlaneado: validarValor(entrada.valorPlaneado),
      notas: entrada.notas?.trim() || null,
    });
  }

  static desdePersistencia(datos: DatosPresupuesto): Presupuesto {
    return new Presupuesto(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get proyectoId(): string | null {
    return this.datos.proyectoId;
  }
  get categoriaId(): string {
    return this.datos.categoriaId;
  }
  get periodoInicio(): FechaIso {
    return this.datos.periodoInicio;
  }
  get periodoFin(): FechaIso {
    return this.datos.periodoFin;
  }
  get valorPlaneado(): number {
    return this.datos.valorPlaneado;
  }

  actualizar(entrada: {
    categoriaId: string;
    periodoInicio: FechaIso;
    periodoFin: FechaIso;
    valorPlaneado: number;
    notas?: string | null;
  }): void {
    validarPeriodo(entrada.periodoInicio, entrada.periodoFin);

    this.datos = {
      ...this.datos,
      categoriaId: entrada.categoriaId,
      periodoInicio: entrada.periodoInicio,
      periodoFin: entrada.periodoFin,
      valorPlaneado: validarValor(entrada.valorPlaneado),
      notas: entrada.notas?.trim() ?? this.datos.notas,
    };
  }

  /** RF-83: la copia mantiene categoria y valor, y mueve el periodo. */
  copiarA(entrada: { id: string; periodoInicio: FechaIso; periodoFin: FechaIso }): Presupuesto {
    return Presupuesto.crear({
      id: entrada.id,
      proyectoId: this.datos.proyectoId,
      categoriaId: this.datos.categoriaId,
      periodoInicio: entrada.periodoInicio,
      periodoFin: entrada.periodoFin,
      valorPlaneado: this.datos.valorPlaneado,
      notas: this.datos.notas,
    });
  }

  aDatos(): DatosPresupuesto {
    return { ...this.datos };
  }
}

/** Periodo mensual a partir de `yyyy-MM`. */
export function periodoMensual(mes: string): { inicio: FechaIso; fin: FechaIso } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new ReglaDeNegocioViolada("PERIODO_INVALIDO", "El mes debe tener el formato AAAA-MM.");
  }
  const [anio, m] = mes.split("-").map(Number) as [number, number];
  return {
    inicio: `${mes}-01`,
    fin: new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10),
  };
}

/** Periodo anual a partir de `yyyy`. */
export function periodoAnual(anio: number): { inicio: FechaIso; fin: FechaIso } {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2200) {
    throw new ReglaDeNegocioViolada("PERIODO_INVALIDO", "El año del presupuesto no es válido.");
  }
  return { inicio: `${anio}-01-01`, fin: `${anio}-12-31` };
}

/** RF-83: el periodo siguiente, del mismo tamaño que el actual. */
export function periodoSiguiente(
  inicio: FechaIso,
  fin: FechaIso,
): { inicio: FechaIso; fin: FechaIso } {
  const esAnual = inicio.slice(5) === "01-01" && fin.slice(5) === "12-31";
  if (esAnual) return periodoAnual(Number(inicio.slice(0, 4)) + 1);

  const [anio, mes] = inicio.split("-").map(Number) as [number, number];
  const siguiente = new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 7);
  return periodoMensual(siguiente);
}

function validarPeriodo(inicio: FechaIso, fin: FechaIso): void {
  if (!esFechaIso(inicio) || !esFechaIso(fin)) {
    throw new ReglaDeNegocioViolada(
      "FECHA_INVALIDA",
      "El periodo del presupuesto no es válido.",
      "periodoInicio",
    );
  }
  if (fin < inicio) {
    throw new ReglaDeNegocioViolada(
      "PERIODO_INVALIDO",
      "El fin del periodo no puede ser anterior al inicio.",
      "periodoFin",
    );
  }
}

function validarValor(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ReglaDeNegocioViolada(
      "VALOR_NO_POSITIVO",
      "El valor planeado no puede ser negativo.",
      "valorPlaneado",
    );
  }
  return Math.round(valor * 100) / 100;
}
