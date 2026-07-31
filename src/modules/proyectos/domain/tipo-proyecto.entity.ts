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
    private _nombre: string,
    private _icono: string | null,
    private _configuracion: ConfiguracionTipoProyecto,
    readonly esSistema: boolean,
    private _activo: boolean,
  ) {
    this._nombre = exigirNombre(_nombre);
    this._configuracion = exigirConfiguracion(_configuracion);
  }

  get nombre(): string {
    return this._nombre;
  }
  get icono(): string | null {
    return this._icono;
  }
  get configuracion(): ConfiguracionTipoProyecto {
    return this._configuracion;
  }
  get activo(): boolean {
    return this._activo;
  }

  /** RF-100: tipos propios del usuario, nunca del sistema. */
  static crear(entrada: {
    id: string;
    codigo: string;
    nombre: string;
    icono?: string | null;
    configuracion: ConfiguracionTipoProyecto;
  }): TipoProyecto {
    return new TipoProyecto(
      entrada.id,
      exigirCodigo(entrada.codigo),
      entrada.nombre,
      entrada.icono ?? null,
      entrada.configuracion,
      false,
      true,
    );
  }

  /**
   * RF-100, RF-34: el catalogo del sistema se puede ocultar pero no editar. La
   * misma regla la defiende un trigger que ni `postgres` puede saltarse (§6.6);
   * aqui se aplica antes para dar un mensaje del dominio y no un error de base.
   */
  actualizar(entrada: {
    nombre: string;
    icono?: string | null;
    configuracion: ConfiguracionTipoProyecto;
  }): void {
    this.exigirEditable();
    this._nombre = exigirNombre(entrada.nombre);
    this._icono = entrada.icono ?? null;
    this._configuracion = exigirConfiguracion(entrada.configuracion);
  }

  activar(): void {
    this._activo = true;
  }

  /** Ocultar sirve para los del sistema tambien: es lo que sustituye al borrado. */
  desactivar(): void {
    this._activo = false;
  }

  private exigirEditable(): void {
    if (this.esSistema) {
      throw new ReglaDeNegocioViolada(
        "TIPO_PROYECTO_DEL_SISTEMA",
        "Los tipos de proyecto del sistema no se pueden modificar; puedes ocultarlos.",
      );
    }
  }

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

function exigirNombre(valor: string): string {
  const nombre = valor.trim();
  if (nombre.length < 1 || nombre.length > 60) {
    throw new ReglaDeNegocioViolada(
      "NOMBRE_INVALIDO",
      "El nombre del tipo de proyecto debe tener entre 1 y 60 caracteres.",
      "nombre",
    );
  }
  return nombre;
}

/**
 * El codigo es identificador: sin acentos, sin espacios y en minusculas (§13.4).
 * Las etiquetas de los atributos si llevan tildes, porque son texto de interfaz.
 */
function exigirCodigo(valor: string): string {
  const codigo = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (codigo.length < 2 || codigo.length > 40) {
    throw new ReglaDeNegocioViolada(
      "CODIGO_INVALIDO",
      "El codigo debe tener entre 2 y 40 caracteres alfanumericos.",
      "codigo",
    );
  }
  return codigo;
}

/** Dos atributos con la misma clave harian que uno sobrescribiera al otro. */
function exigirConfiguracion(configuracion: ConfiguracionTipoProyecto): ConfiguracionTipoProyecto {
  const claves = configuracion.atributos.map((a) => a.clave);
  if (new Set(claves).size !== claves.length) {
    throw new ReglaDeNegocioViolada(
      "ATRIBUTO_DUPLICADO",
      "Hay dos atributos con la misma clave.",
      "atributos",
    );
  }
  for (const atributo of configuracion.atributos) {
    if (!/^[a-z][a-z0-9_]*$/.test(atributo.clave)) {
      throw new ReglaDeNegocioViolada(
        "CLAVE_ATRIBUTO_INVALIDA",
        `La clave «${atributo.clave}» debe empezar por letra y llevar solo minusculas, numeros o guion bajo.`,
        "atributos",
      );
    }
  }
  return configuracion;
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
