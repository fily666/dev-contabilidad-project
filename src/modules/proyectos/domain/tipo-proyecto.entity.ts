import { ReglaDeNegocioViolada } from "@/shared/domain/errores";

/** Tipos primitivos admitidos por un atributo dinamico (Contexto.md §13). */
export const TIPOS_ATRIBUTO = ["text", "number", "date", "boolean"] as const;
export type TipoAtributo = (typeof TIPOS_ATRIBUTO)[number];

export type DefinicionAtributo = {
  clave: string;
  etiqueta: string;
  tipo: TipoAtributo;
  requerido: boolean;
};

export type ConfiguracionTipoProyecto = {
  atributos: DefinicionAtributo[];
  /** Claves de indicadores visibles para este tipo (§5.4). */
  indicadores: string[];
  generaIngresos: boolean;
  seValoriza: boolean;
};

export type ValorAtributo = string | number | boolean | null;

/**
 * Tipo de proyecto. Su `configuracion` declara los atributos propios y los
 * indicadores visibles, de modo que agregar un tipo nuevo no requiere
 * migraciones ni cambios en la logica existente (Contexto.md §13, RNF-10).
 */
export class TipoProyecto {
  constructor(
    readonly id: string,
    readonly codigo: string,
    readonly nombre: string,
    readonly icono: string | null,
    readonly configuracion: ConfiguracionTipoProyecto,
    readonly esSistema: boolean,
    readonly activo: boolean,
  ) {}

  /** ¿Debe mostrarse este indicador para el tipo? (§5.4) */
  muestraIndicador(clave: string): boolean {
    return this.configuracion.indicadores.includes(clave);
  }

  /**
   * Valida los atributos dinamicos contra la definicion del tipo y devuelve
   * solo las claves declaradas, ya convertidas al tipo correcto.
   */
  validarAtributos(valores: Record<string, unknown>): Record<string, ValorAtributo> {
    const resultado: Record<string, ValorAtributo> = {};
    const faltantes: string[] = [];

    for (const definicion of this.configuracion.atributos) {
      const crudo = valores[definicion.clave];
      const vacio = crudo === undefined || crudo === null || crudo === "";

      if (vacio) {
        if (definicion.requerido) faltantes.push(definicion.etiqueta);
        continue;
      }

      resultado[definicion.clave] = this.convertir(definicion, crudo);
    }

    if (faltantes.length > 0) {
      throw new ReglaDeNegocioViolada(
        "ATRIBUTO_REQUERIDO",
        `Faltan atributos obligatorios de ${this.nombre}: ${faltantes.join(", ")}.`,
        "atributos",
      );
    }

    return resultado;
  }

  private convertir(definicion: DefinicionAtributo, crudo: unknown): ValorAtributo {
    switch (definicion.tipo) {
      case "number": {
        // Limpiar y luego usar Number() no basta: "ayer" quedaria en cadena
        // vacia y Number("") es 0. Se exige que quede al menos un digito.
        const limpio =
          typeof crudo === "number" ? String(crudo) : String(crudo).replace(/[^\d.-]/g, "");
        const n = /\d/.test(limpio) ? Number(limpio) : Number.NaN;
        if (!Number.isFinite(n)) {
          throw new ReglaDeNegocioViolada(
            "ATRIBUTO_INVALIDO",
            `${definicion.etiqueta} debe ser un numero.`,
            `atributos.${definicion.clave}`,
          );
        }
        return n;
      }
      case "boolean":
        return crudo === true || crudo === "true" || crudo === "1";
      case "date":
      case "text":
      default:
        return String(crudo).trim();
    }
  }
}

/** Normaliza la configuracion almacenada en JSONB, tolerando campos ausentes. */
export function leerConfiguracion(crudo: unknown): ConfiguracionTipoProyecto {
  const objeto = (crudo ?? {}) as Record<string, unknown>;
  const atributosCrudos = Array.isArray(objeto.atributos) ? objeto.atributos : [];
  const indicadoresCrudos = Array.isArray(objeto.indicadores) ? objeto.indicadores : [];

  return {
    atributos: atributosCrudos.flatMap((a): DefinicionAtributo[] => {
      const item = (a ?? {}) as Record<string, unknown>;
      const clave = typeof item.clave === "string" ? item.clave : null;
      if (!clave) return [];
      const tipo = TIPOS_ATRIBUTO.includes(item.tipo as TipoAtributo)
        ? (item.tipo as TipoAtributo)
        : "text";
      return [
        {
          clave,
          etiqueta: typeof item.etiqueta === "string" ? item.etiqueta : clave,
          tipo,
          requerido: item.requerido === true,
        },
      ];
    }),
    indicadores: indicadoresCrudos.filter((i): i is string => typeof i === "string"),
    generaIngresos: objeto.genera_ingresos !== false,
    seValoriza: objeto.se_valoriza === true,
  };
}
