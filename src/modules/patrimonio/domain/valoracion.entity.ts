import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";

export type DatosValoracion = {
  id: string;
  proyectoId: string;
  fecha: FechaIso;
  valor: number;
  fuente: string | null;
  notas: string | null;
};

/**
 * Valoracion del activo en un momento dado (RF-16).
 *
 * La depreciacion y la valorizacion NO se calculan (§17): el valor comercial se
 * registra a mano cuando se conoce, porque un modelo automatico de depreciacion
 * daria una cifra creible y falsa, y de esta sale la plusvalia de §5.3.
 */
export class Valoracion {
  private constructor(private datos: DatosValoracion) {}

  static crear(entrada: {
    id: string;
    proyectoId: string;
    fecha: FechaIso;
    valor: number;
    fuente?: string | null;
    notas?: string | null;
  }): Valoracion {
    if (!esFechaIso(entrada.fecha)) {
      throw new ReglaDeNegocioViolada(
        "FECHA_INVALIDA",
        "La fecha de la valoracion no es valida.",
        "fecha",
      );
    }
    if (!Number.isFinite(entrada.valor) || entrada.valor < 0) {
      throw new ReglaDeNegocioViolada(
        "VALOR_NO_POSITIVO",
        "El valor comercial no puede ser negativo.",
        "valor",
      );
    }

    return new Valoracion({
      id: entrada.id,
      proyectoId: entrada.proyectoId,
      fecha: entrada.fecha,
      valor: Math.round(entrada.valor * 100) / 100,
      fuente: entrada.fuente?.trim() || null,
      notas: entrada.notas?.trim() || null,
    });
  }

  static desdePersistencia(datos: DatosValoracion): Valoracion {
    return new Valoracion(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get proyectoId(): string {
    return this.datos.proyectoId;
  }
  get fecha(): FechaIso {
    return this.datos.fecha;
  }
  get valor(): number {
    return this.datos.valor;
  }

  aDatos(): DatosValoracion {
    return { ...this.datos };
  }
}

/**
 * Variacion entre dos valoraciones, en tanto por uno. `null` si no hay con que
 * comparar o si la base es cero (guarda de §5.3).
 */
export function variacionDeValor(
  valoraciones: readonly { fecha: FechaIso; valor: number }[],
): number | null {
  if (valoraciones.length < 2) return null;
  const ordenadas = [...valoraciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const primera = ordenadas[0]!;
  const ultima = ordenadas.at(-1)!;
  if (primera.valor === 0) return null;
  return (ultima.valor - primera.valor) / primera.valor;
}
