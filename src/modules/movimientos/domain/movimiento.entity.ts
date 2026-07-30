import { Dinero } from "@/shared/domain/dinero";
import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";
import {
  naturalezaEsCompatible,
  type EstadoMovimiento,
  type Naturaleza,
  type TipoMovimiento,
} from "@/shared/domain/enumeraciones";

export type DatosMovimiento = {
  id: string;
  proyectoId: string;
  categoriaId: string;
  metodoPagoId: string | null;
  tipo: TipoMovimiento;
  naturaleza: Naturaleza;
  fecha: FechaIso;
  fechaVencimiento: FechaIso | null;
  fechaPago: FechaIso | null;
  valor: number;
  moneda: string;
  abonoCapital: number | null;
  abonoInteres: number | null;
  descripcion: string;
  observaciones: string | null;
  estado: EstadoMovimiento;
  motivoAnulacion: string | null;
  ocurrenciaId: string | null;
};

export type EntradaCrearMovimiento = {
  id: string;
  proyectoId: string;
  categoriaId: string;
  /** Naturaleza propuesta por la categoria; el usuario puede sobreescribirla (RF-21). */
  naturalezaDeCategoria: Naturaleza;
  naturaleza?: Naturaleza;
  tipo: TipoMovimiento;
  metodoPagoId?: string | null;
  fecha: FechaIso;
  fechaVencimiento?: FechaIso | null;
  fechaPago?: FechaIso | null;
  valor: number;
  moneda: string;
  abonoCapital?: number | null;
  abonoInteres?: number | null;
  descripcion: string;
  observaciones?: string | null;
  estado?: Extract<EstadoMovimiento, "pendiente" | "pagado">;
  ocurrenciaId?: string | null;
};

/**
 * Movimiento financiero: el unico registro que afecta cifras (Contexto.md §2).
 * Concentra las invariantes de §5.7.
 */
export class Movimiento {
  private constructor(private datos: DatosMovimiento) {}

  static crear(entrada: EntradaCrearMovimiento): Movimiento {
    const naturaleza = entrada.naturaleza ?? entrada.naturalezaDeCategoria;

    // Invariante §5.7.3: la naturaleza debe ser compatible con el tipo.
    if (!naturalezaEsCompatible(entrada.tipo, naturaleza)) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_INCOMPATIBLE",
        `La naturaleza «${naturaleza}» no aplica a un movimiento de tipo «${entrada.tipo}».`,
        "naturaleza",
      );
    }

    const valor = validarValor(entrada.valor, entrada.moneda);
    const estado: EstadoMovimiento = entrada.estado ?? "pendiente";
    const fechaPago = estado === "pagado" ? (entrada.fechaPago ?? entrada.fecha) : null;

    validarFecha(entrada.fecha, "fecha");
    if (entrada.fechaVencimiento) validarFecha(entrada.fechaVencimiento, "fechaVencimiento");
    if (fechaPago) validarFecha(fechaPago, "fechaPago");

    // Invariante §5.7.4: un movimiento pagado exige fecha y metodo de pago.
    if (estado === "pagado" && !entrada.metodoPagoId) {
      throw new ReglaDeNegocioViolada(
        "METODO_PAGO_REQUERIDO",
        "Un movimiento pagado debe indicar el metodo de pago.",
        "metodoPagoId",
      );
    }

    const desglose = validarDesglose(
      entrada.abonoCapital ?? null,
      entrada.abonoInteres ?? null,
      valor,
      naturaleza,
    );

    return new Movimiento({
      id: entrada.id,
      proyectoId: entrada.proyectoId,
      categoriaId: entrada.categoriaId,
      metodoPagoId: entrada.metodoPagoId ?? null,
      tipo: entrada.tipo,
      naturaleza,
      fecha: entrada.fecha,
      fechaVencimiento: entrada.fechaVencimiento ?? null,
      fechaPago,
      valor: valor.valor,
      moneda: valor.moneda,
      abonoCapital: desglose.capital,
      abonoInteres: desglose.interes,
      descripcion: validarDescripcion(entrada.descripcion),
      observaciones: entrada.observaciones?.trim() || null,
      estado,
      motivoAnulacion: null,
      ocurrenciaId: entrada.ocurrenciaId ?? null,
    });
  }

  static desdePersistencia(datos: DatosMovimiento): Movimiento {
    return new Movimiento(datos);
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
  get tipo(): TipoMovimiento {
    return this.datos.tipo;
  }
  get naturaleza(): Naturaleza {
    return this.datos.naturaleza;
  }
  get estado(): EstadoMovimiento {
    return this.datos.estado;
  }
  get fecha(): FechaIso {
    return this.datos.fecha;
  }
  get fechaVencimiento(): FechaIso | null {
    return this.datos.fechaVencimiento;
  }
  get fechaPago(): FechaIso | null {
    return this.datos.fechaPago;
  }
  get descripcion(): string {
    return this.datos.descripcion;
  }
  get dinero(): Dinero {
    return Dinero.de(this.datos.valor, this.datos.moneda);
  }
  get moneda(): string {
    return this.datos.moneda;
  }

  /** Solo los pagados alimentan la caja ejecutada (regla de oro §2). */
  afectaCaja(): boolean {
    return this.datos.estado === "pagado";
  }

  /** ¿Capitaliza? Determina si suma al total invertido (§5.1). */
  esInversion(): boolean {
    return this.datos.tipo === "egreso" && this.datos.naturaleza === "capex";
  }

  /**
   * §5.7 y RF-25: un pendiente cuya fecha de vencimiento ya paso se presenta
   * como vencido. El estado persistido lo sincroniza la tarea diaria (§10.1).
   */
  estadoEfectivo(hoy: FechaIso): EstadoMovimiento {
    if (
      this.datos.estado === "pendiente" &&
      this.datos.fechaVencimiento !== null &&
      this.datos.fechaVencimiento < hoy
    ) {
      return "vencido";
    }
    return this.datos.estado;
  }

  actualizar(entrada: {
    categoriaId: string;
    naturalezaDeCategoria: Naturaleza;
    naturaleza?: Naturaleza;
    tipo: TipoMovimiento;
    metodoPagoId?: string | null;
    fecha: FechaIso;
    fechaVencimiento?: FechaIso | null;
    valor: number;
    descripcion: string;
    observaciones?: string | null;
    abonoCapital?: number | null;
    abonoInteres?: number | null;
  }): void {
    this.exigirEditable();

    const naturaleza = entrada.naturaleza ?? entrada.naturalezaDeCategoria;
    if (!naturalezaEsCompatible(entrada.tipo, naturaleza)) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_INCOMPATIBLE",
        `La naturaleza «${naturaleza}» no aplica a un movimiento de tipo «${entrada.tipo}».`,
        "naturaleza",
      );
    }

    const valor = validarValor(entrada.valor, this.datos.moneda);
    validarFecha(entrada.fecha, "fecha");
    if (entrada.fechaVencimiento) validarFecha(entrada.fechaVencimiento, "fechaVencimiento");

    const desglose = validarDesglose(
      entrada.abonoCapital ?? null,
      entrada.abonoInteres ?? null,
      valor,
      naturaleza,
    );

    this.datos = {
      ...this.datos,
      categoriaId: entrada.categoriaId,
      naturaleza,
      tipo: entrada.tipo,
      metodoPagoId: entrada.metodoPagoId ?? this.datos.metodoPagoId,
      fecha: entrada.fecha,
      fechaVencimiento: entrada.fechaVencimiento ?? null,
      valor: valor.valor,
      abonoCapital: desglose.capital,
      abonoInteres: desglose.interes,
      descripcion: validarDescripcion(entrada.descripcion),
      observaciones: entrada.observaciones?.trim() || null,
    };
  }

  /** RF-26. */
  marcarPagado(entrada: { fechaPago: FechaIso; metodoPagoId: string }): void {
    this.exigirEditable();
    if (this.datos.estado === "pagado") {
      throw new ReglaDeNegocioViolada(
        "MOVIMIENTO_YA_PAGADO",
        "El movimiento ya esta registrado como pagado.",
      );
    }
    validarFecha(entrada.fechaPago, "fechaPago");

    this.datos.estado = "pagado";
    this.datos.fechaPago = entrada.fechaPago;
    this.datos.metodoPagoId = entrada.metodoPagoId;
  }

  /** RF-22: la anulacion conserva el registro y lo excluye de las cifras. */
  anular(motivo: string): void {
    const limpio = motivo.trim();
    if (limpio.length < 3) {
      throw new ReglaDeNegocioViolada(
        "MOTIVO_REQUERIDO",
        "Indica el motivo de la anulacion (minimo 3 caracteres).",
        "motivo",
      );
    }
    if (this.datos.estado === "anulado") {
      throw new ReglaDeNegocioViolada("MOVIMIENTO_ANULADO", "El movimiento ya esta anulado.");
    }

    this.datos.estado = "anulado";
    this.datos.motivoAnulacion = limpio;
  }

  aDatos(): DatosMovimiento {
    return { ...this.datos };
  }

  private exigirEditable(): void {
    if (this.datos.estado === "anulado") {
      throw new ReglaDeNegocioViolada(
        "MOVIMIENTO_ANULADO",
        "El movimiento esta anulado y no admite cambios.",
      );
    }
  }
}

/** Invariante §5.7.2: el valor siempre es positivo; el signo lo da el tipo. */
function validarValor(valor: number, moneda: string): Dinero {
  const dinero = Dinero.de(valor, moneda);
  if (!dinero.esPositivo()) {
    throw new ReglaDeNegocioViolada(
      "VALOR_NO_POSITIVO",
      "El valor debe ser mayor que cero.",
      "valor",
    );
  }
  return dinero;
}

function validarDescripcion(valor: string): string {
  const descripcion = valor.trim();
  if (descripcion.length < 1 || descripcion.length > 200) {
    throw new ReglaDeNegocioViolada(
      "DESCRIPCION_INVALIDA",
      "La descripcion debe tener entre 1 y 200 caracteres.",
      "descripcion",
    );
  }
  return descripcion;
}

function validarFecha(valor: FechaIso, campo: string): void {
  if (!esFechaIso(valor)) {
    throw new ReglaDeNegocioViolada("FECHA_INVALIDA", "La fecha no es valida.", campo);
  }
}

/** RF-29: capital + interes debe igualar el valor de la cuota. */
function validarDesglose(
  capital: number | null,
  interes: number | null,
  valor: Dinero,
  naturaleza: Naturaleza,
): { capital: number | null; interes: number | null } {
  if (capital === null && interes === null) return { capital: null, interes: null };

  if (naturaleza !== "financiacion") {
    throw new ReglaDeNegocioViolada(
      "DESGLOSE_NO_APLICA",
      "El desglose de capital e interes solo aplica a movimientos de financiacion.",
      "abonoCapital",
    );
  }
  if (capital === null || interes === null) {
    throw new ReglaDeNegocioViolada(
      "DESGLOSE_INCOMPLETO",
      "Indica tanto el abono a capital como los intereses.",
      "abonoCapital",
    );
  }

  const dCapital = Dinero.de(capital, valor.moneda);
  const dInteres = Dinero.de(interes, valor.moneda);
  if (dCapital.esNegativo() || dInteres.esNegativo()) {
    throw new ReglaDeNegocioViolada(
      "DESGLOSE_INVALIDO",
      "El abono a capital y los intereses no pueden ser negativos.",
      "abonoCapital",
    );
  }
  if (!dCapital.mas(dInteres).igualA(valor)) {
    throw new ReglaDeNegocioViolada(
      "DESGLOSE_INVALIDO",
      "La suma de capital e intereses debe ser igual al valor de la cuota.",
      "abonoCapital",
    );
  }

  return { capital: dCapital.valor, interes: dInteres.valor };
}
