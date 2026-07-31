import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Frecuencia } from "@/shared/domain/enumeraciones";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";
import { fechasDeRecurrencia, mesesPorFrecuencia } from "./recurrencia";

export type DatosObligacion = {
  id: string;
  proyectoId: string;
  categoriaId: string;
  concepto: string;
  valorEstimado: number;
  /** Vencimiento de la primera ocurrencia; las demas se derivan (§5.6). */
  fechaVencimiento: FechaIso;
  frecuencia: Frecuencia;
  intervaloMeses: number | null;
  /** Dias de anticipacion del aviso (RF-53). Por omision 5 y 1. */
  diasAviso: number[];
  crearMovimientoAuto: boolean;
  activa: boolean;
};

export type EntradaCrearObligacion = {
  id: string;
  proyectoId: string;
  categoriaId: string;
  concepto: string;
  valorEstimado: number;
  fechaVencimiento: FechaIso;
  frecuencia: Frecuencia;
  intervaloMeses?: number | null;
  diasAviso?: number[];
  crearMovimientoAuto?: boolean;
};

export const DIAS_AVISO_POR_OMISION = [5, 1];

/**
 * Obligacion recurrente: un compromiso de pago que se repite (Contexto.md §2,
 * RF-50 a RF-57). No mueve dinero por si misma: cada vencimiento se materializa
 * como ocurrencia, y pagar una ocurrencia es lo que crea el movimiento (ADR-08,
 * ADR-09).
 */
export class Obligacion {
  private constructor(private datos: DatosObligacion) {}

  static crear(entrada: EntradaCrearObligacion): Obligacion {
    const frecuencia = entrada.frecuencia;
    const intervaloMeses = validarIntervalo(frecuencia, entrada.intervaloMeses ?? null);

    return new Obligacion({
      id: entrada.id,
      proyectoId: entrada.proyectoId,
      categoriaId: entrada.categoriaId,
      concepto: validarConcepto(entrada.concepto),
      valorEstimado: validarValor(entrada.valorEstimado),
      fechaVencimiento: validarFecha(entrada.fechaVencimiento),
      frecuencia,
      intervaloMeses,
      diasAviso: validarDiasAviso(entrada.diasAviso ?? DIAS_AVISO_POR_OMISION),
      crearMovimientoAuto: entrada.crearMovimientoAuto ?? false,
      activa: true,
    });
  }

  static desdePersistencia(datos: DatosObligacion): Obligacion {
    return new Obligacion(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get proyectoId(): string {
    return this.datos.proyectoId;
  }
  get categoriaId(): string {
    return this.datos.categoriaId;
  }
  get concepto(): string {
    return this.datos.concepto;
  }
  get valorEstimado(): number {
    return this.datos.valorEstimado;
  }
  get fechaVencimiento(): FechaIso {
    return this.datos.fechaVencimiento;
  }
  get frecuencia(): Frecuencia {
    return this.datos.frecuencia;
  }
  get intervaloMeses(): number | null {
    return this.datos.intervaloMeses;
  }
  get diasAviso(): number[] {
    return [...this.datos.diasAviso];
  }
  get crearMovimientoAuto(): boolean {
    return this.datos.crearMovimientoAuto;
  }
  get activa(): boolean {
    return this.datos.activa;
  }

  /** ¿Se repite? Una obligacion `unica` no genera mas de una ocurrencia. */
  get esRecurrente(): boolean {
    return mesesPorFrecuencia(this.datos.frecuencia, this.datos.intervaloMeses) > 0;
  }

  /**
   * Vencimientos dentro del horizonte (RF-52). Es la misma serie que materializa
   * `generar_ocurrencias` en la base; aqui sirve para previsualizar y proyectar.
   */
  vencimientosHasta(limite: FechaIso): FechaIso[] {
    if (!this.datos.activa) return [];
    return fechasDeRecurrencia({
      primera: this.datos.fechaVencimiento,
      frecuencia: this.datos.frecuencia,
      intervaloMeses: this.datos.intervaloMeses,
      limite,
    });
  }

  actualizar(entrada: {
    categoriaId: string;
    concepto: string;
    valorEstimado: number;
    fechaVencimiento: FechaIso;
    frecuencia: Frecuencia;
    intervaloMeses?: number | null;
    diasAviso?: number[];
    crearMovimientoAuto?: boolean;
  }): void {
    this.datos = {
      ...this.datos,
      categoriaId: entrada.categoriaId,
      concepto: validarConcepto(entrada.concepto),
      valorEstimado: validarValor(entrada.valorEstimado),
      fechaVencimiento: validarFecha(entrada.fechaVencimiento),
      frecuencia: entrada.frecuencia,
      intervaloMeses: validarIntervalo(entrada.frecuencia, entrada.intervaloMeses ?? null),
      diasAviso: validarDiasAviso(entrada.diasAviso ?? this.datos.diasAviso),
      crearMovimientoAuto: entrada.crearMovimientoAuto ?? this.datos.crearMovimientoAuto,
    };
  }

  /** RF-57: suspender detiene la generacion de ocurrencias nuevas. */
  suspender(): void {
    if (!this.datos.activa) {
      throw new ReglaDeNegocioViolada(
        "OBLIGACION_YA_SUSPENDIDA",
        "La obligacion ya esta suspendida.",
      );
    }
    this.datos.activa = false;
  }

  /** RF-57. */
  reactivar(): void {
    this.datos.activa = true;
  }

  aDatos(): DatosObligacion {
    return { ...this.datos, diasAviso: [...this.datos.diasAviso] };
  }
}

function validarConcepto(valor: string): string {
  const concepto = valor.trim();
  if (concepto.length < 1 || concepto.length > 150) {
    throw new ReglaDeNegocioViolada(
      "CONCEPTO_INVALIDO",
      "El concepto debe tener entre 1 y 150 caracteres.",
      "concepto",
    );
  }
  return concepto;
}

/**
 * A diferencia del movimiento, el valor estimado admite cero: hay obligaciones
 * de valor variable (un servicio publico) cuyo importe solo se conoce al pagar.
 */
function validarValor(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ReglaDeNegocioViolada(
      "VALOR_NO_POSITIVO",
      "El valor estimado no puede ser negativo.",
      "valorEstimado",
    );
  }
  return Math.round(valor * 100) / 100;
}

function validarFecha(valor: FechaIso): FechaIso {
  if (!esFechaIso(valor)) {
    throw new ReglaDeNegocioViolada(
      "FECHA_INVALIDA",
      "La fecha de vencimiento no es valida.",
      "fechaVencimiento",
    );
  }
  return valor;
}

/** RF-51: la frecuencia personalizada exige el intervalo; las demas lo ignoran. */
function validarIntervalo(frecuencia: Frecuencia, intervalo: number | null): number | null {
  if (frecuencia !== "personalizada") return null;

  if (intervalo === null || !Number.isInteger(intervalo) || intervalo < 1 || intervalo > 60) {
    throw new ReglaDeNegocioViolada(
      "INTERVALO_INVALIDO",
      "Una frecuencia personalizada requiere un intervalo entre 1 y 60 meses.",
      "intervaloMeses",
    );
  }
  return intervalo;
}

function validarDiasAviso(dias: number[]): number[] {
  const limpios = [...new Set(dias.map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 90)
    .sort((a, b) => b - a);

  if (limpios.length !== dias.length && dias.length > 0 && limpios.length === 0) {
    throw new ReglaDeNegocioViolada(
      "DIAS_AVISO_INVALIDOS",
      "Los dias de aviso deben ser numeros entre 0 y 90.",
      "diasAviso",
    );
  }
  return limpios;
}
