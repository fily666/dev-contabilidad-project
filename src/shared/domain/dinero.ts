import { ErrorDeDominio } from "./errores";

const ESCALA = 100; // dos decimales (Contexto.md §8.4)

export class MonedaIncompatible extends ErrorDeDominio {
  constructor(a: string, b: string) {
    super("MONEDA_INCOMPATIBLE", `No se pueden operar montos en ${a} y ${b}.`);
  }
}

export class MontoInvalido extends ErrorDeDominio {
  constructor(mensaje: string) {
    super("MONTO_INVALIDO", mensaje);
  }
}

/**
 * Value object para importes. Contexto.md §8.4 y ADR-10.
 *
 * Guarda centavos como entero para que la aritmetica sea exacta: nunca se
 * acumulan errores de punto flotante. Prohibido operar importes como `number`.
 */
export class Dinero {
  private constructor(
    /** Importe en centavos. */
    private readonly centavos: number,
    readonly moneda: string,
  ) {}

  static de(monto: number, moneda = "COP"): Dinero {
    if (!Number.isFinite(monto)) {
      throw new MontoInvalido("El monto debe ser un numero finito.");
    }
    return new Dinero(Math.round(monto * ESCALA), moneda.toUpperCase());
  }

  static cero(moneda = "COP"): Dinero {
    return new Dinero(0, moneda.toUpperCase());
  }

  /** Suma una lista; devuelve cero en la moneda indicada si la lista esta vacia. */
  static sumar(montos: readonly Dinero[], moneda = "COP"): Dinero {
    return montos.reduce((acc, m) => acc.mas(m), Dinero.cero(moneda));
  }

  get valor(): number {
    return this.centavos / ESCALA;
  }

  esCero(): boolean {
    return this.centavos === 0;
  }

  esPositivo(): boolean {
    return this.centavos > 0;
  }

  esNegativo(): boolean {
    return this.centavos < 0;
  }

  mas(otro: Dinero): Dinero {
    this.exigirMismaMoneda(otro);
    return new Dinero(this.centavos + otro.centavos, this.moneda);
  }

  menos(otro: Dinero): Dinero {
    this.exigirMismaMoneda(otro);
    return new Dinero(this.centavos - otro.centavos, this.moneda);
  }

  por(factor: number): Dinero {
    if (!Number.isFinite(factor)) {
      throw new MontoInvalido("El factor debe ser un numero finito.");
    }
    return new Dinero(Math.round(this.centavos * factor), this.moneda);
  }

  /**
   * Razon entre dos importes. Devuelve `null` cuando el divisor es cero, para
   * cumplir la guarda de §5.3: los indicadores porcentuales nunca son NaN ni Infinity.
   */
  dividido(otro: Dinero): number | null {
    this.exigirMismaMoneda(otro);
    if (otro.centavos === 0) return null;
    return this.centavos / otro.centavos;
  }

  negado(): Dinero {
    return new Dinero(-this.centavos, this.moneda);
  }

  absoluto(): Dinero {
    return new Dinero(Math.abs(this.centavos), this.moneda);
  }

  igualA(otro: Dinero): boolean {
    return this.moneda === otro.moneda && this.centavos === otro.centavos;
  }

  mayorQue(otro: Dinero): boolean {
    this.exigirMismaMoneda(otro);
    return this.centavos > otro.centavos;
  }

  menorQue(otro: Dinero): boolean {
    this.exigirMismaMoneda(otro);
    return this.centavos < otro.centavos;
  }

  /** Valor listo para persistir en `numeric(18,2)`. */
  aNumero(): number {
    return this.valor;
  }

  toString(): string {
    return `${this.valor.toFixed(2)} ${this.moneda}`;
  }

  toJSON(): { valor: number; moneda: string } {
    return { valor: this.valor, moneda: this.moneda };
  }

  private exigirMismaMoneda(otro: Dinero): void {
    if (this.moneda !== otro.moneda) {
      throw new MonedaIncompatible(this.moneda, otro.moneda);
    }
  }
}
