import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";

/** Tipos de pasivo del catalogo (§6.2). */
export const TIPOS_PASIVO = [
  "credito_hipotecario",
  "credito_vehiculo",
  "credito_libre",
  "tarjeta_credito",
  "otro",
] as const;
export type TipoPasivo = (typeof TIPOS_PASIVO)[number];

export type DatosPasivo = {
  id: string;
  proyectoId: string;
  nombre: string;
  tipo: TipoPasivo;
  montoOriginal: number;
  saldoActual: number;
  tasaInteresEa: number | null;
  plazoMeses: number | null;
  valorCuota: number | null;
  fechaDesembolso: FechaIso;
  activo: boolean;
};

/**
 * Pasivo del proyecto: credito, tarjeta o cualquier deuda asociada (RF-17).
 *
 * El saldo se actualiza a mano o abonando capital con un movimiento de
 * financiacion; no se recalcula solo. La razon esta en §17: la amortizacion
 * detallada quedo fuera de v1, y un saldo inventado por interpolacion seria peor
 * que uno que el dueño escribe cuando le llega el extracto.
 */
export class Pasivo {
  private constructor(private datos: DatosPasivo) {}

  static crear(entrada: {
    id: string;
    proyectoId: string;
    nombre: string;
    tipo: TipoPasivo;
    montoOriginal: number;
    saldoActual?: number;
    tasaInteresEa?: number | null;
    plazoMeses?: number | null;
    valorCuota?: number | null;
    fechaDesembolso: FechaIso;
  }): Pasivo {
    const montoOriginal = exigirPositivo(entrada.montoOriginal, "montoOriginal");

    return new Pasivo({
      id: entrada.id,
      proyectoId: entrada.proyectoId,
      nombre: exigirNombre(entrada.nombre),
      tipo: exigirTipo(entrada.tipo),
      montoOriginal,
      saldoActual: exigirSaldo(entrada.saldoActual ?? montoOriginal),
      tasaInteresEa: exigirTasa(entrada.tasaInteresEa ?? null),
      plazoMeses: exigirPlazo(entrada.plazoMeses ?? null),
      valorCuota:
        entrada.valorCuota === null || entrada.valorCuota === undefined
          ? null
          : exigirPositivo(entrada.valorCuota, "valorCuota"),
      fechaDesembolso: exigirFecha(entrada.fechaDesembolso),
      activo: true,
    });
  }

  static desdePersistencia(datos: DatosPasivo): Pasivo {
    return new Pasivo(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get proyectoId(): string {
    return this.datos.proyectoId;
  }
  get nombre(): string {
    return this.datos.nombre;
  }
  get tipo(): TipoPasivo {
    return this.datos.tipo;
  }
  get montoOriginal(): number {
    return this.datos.montoOriginal;
  }
  get saldoActual(): number {
    return this.datos.saldoActual;
  }
  get valorCuota(): number | null {
    return this.datos.valorCuota;
  }
  get activo(): boolean {
    return this.datos.activo;
  }

  /** Cuanto del credito ya se pago, en tanto por uno. `null` si no aplica. */
  get amortizado(): number | null {
    if (this.datos.montoOriginal <= 0) return null;
    const razon = 1 - this.datos.saldoActual / this.datos.montoOriginal;
    return Math.min(1, Math.max(0, razon));
  }

  actualizar(entrada: {
    nombre: string;
    tipo: TipoPasivo;
    montoOriginal: number;
    saldoActual: number;
    tasaInteresEa?: number | null;
    plazoMeses?: number | null;
    valorCuota?: number | null;
    fechaDesembolso: FechaIso;
  }): void {
    this.datos = {
      ...this.datos,
      nombre: exigirNombre(entrada.nombre),
      tipo: exigirTipo(entrada.tipo),
      montoOriginal: exigirPositivo(entrada.montoOriginal, "montoOriginal"),
      saldoActual: exigirSaldo(entrada.saldoActual),
      tasaInteresEa: exigirTasa(entrada.tasaInteresEa ?? null),
      plazoMeses: exigirPlazo(entrada.plazoMeses ?? null),
      valorCuota:
        entrada.valorCuota === null || entrada.valorCuota === undefined
          ? null
          : exigirPositivo(entrada.valorCuota, "valorCuota"),
      fechaDesembolso: exigirFecha(entrada.fechaDesembolso),
    };
  }

  /** Abono a capital: baja el saldo sin tocar el monto original. */
  abonarACapital(valor: number): void {
    const abono = exigirPositivo(valor, "valor");
    if (abono > this.datos.saldoActual) {
      throw new ReglaDeNegocioViolada(
        "ABONO_MAYOR_QUE_SALDO",
        "El abono no puede ser mayor que el saldo pendiente.",
        "valor",
      );
    }
    this.datos.saldoActual = redondear(this.datos.saldoActual - abono);
    if (this.datos.saldoActual === 0) this.datos.activo = false;
  }

  /** Un pasivo saldado se cierra; deja de sumar al pasivo total (RF-78). */
  cerrar(): void {
    this.datos.activo = false;
  }

  reactivar(): void {
    this.datos.activo = true;
  }

  aDatos(): DatosPasivo {
    return { ...this.datos };
  }
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function exigirNombre(valor: string): string {
  const nombre = valor.trim();
  if (nombre.length < 1 || nombre.length > 120) {
    throw new ReglaDeNegocioViolada(
      "NOMBRE_INVALIDO",
      "El nombre del pasivo debe tener entre 1 y 120 caracteres.",
      "nombre",
    );
  }
  return nombre;
}

function exigirTipo(tipo: TipoPasivo): TipoPasivo {
  if (!TIPOS_PASIVO.includes(tipo)) {
    throw new ReglaDeNegocioViolada("TIPO_PASIVO_INVALIDO", "El tipo de pasivo no existe.", "tipo");
  }
  return tipo;
}

function exigirPositivo(valor: number, campo: string): number {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ReglaDeNegocioViolada(
      "VALOR_NO_POSITIVO",
      "El valor debe ser mayor que cero.",
      campo,
    );
  }
  return redondear(valor);
}

function exigirSaldo(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ReglaDeNegocioViolada(
      "SALDO_INVALIDO",
      "El saldo no puede ser negativo.",
      "saldoActual",
    );
  }
  return redondear(valor);
}

/** Tasa efectiva anual en tanto por uno: 0,12 es 12 % E.A. */
function exigirTasa(valor: number | null): number | null {
  if (valor === null) return null;
  if (!Number.isFinite(valor) || valor < 0 || valor > 2) {
    throw new ReglaDeNegocioViolada(
      "TASA_INVALIDA",
      "La tasa efectiva anual se expresa en tanto por uno, entre 0 y 2.",
      "tasaInteresEa",
    );
  }
  return Math.round(valor * 10_000) / 10_000;
}

function exigirPlazo(valor: number | null): number | null {
  if (valor === null) return null;
  if (!Number.isInteger(valor) || valor < 1 || valor > 600) {
    throw new ReglaDeNegocioViolada(
      "PLAZO_INVALIDO",
      "El plazo se expresa en meses completos, entre 1 y 600.",
      "plazoMeses",
    );
  }
  return valor;
}

function exigirFecha(valor: FechaIso): FechaIso {
  if (!esFechaIso(valor)) {
    throw new ReglaDeNegocioViolada(
      "FECHA_INVALIDA",
      "La fecha de desembolso no es valida.",
      "fechaDesembolso",
    );
  }
  return valor;
}
