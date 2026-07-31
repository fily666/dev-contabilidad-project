import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { CategoriaRepository } from "@/modules/categorias/domain/categoria.repository";
import type { MetodoPagoRepository } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";

import {
  MAXIMO_FILAS_CSV,
  leerCsvDeMovimientos,
  type FilaImportacion,
} from "../domain/importacion";
import type { RegistrarMovimiento } from "./registrar-movimiento.use-case";

/** RF-27: carga en lote con previsualizacion y validacion fila por fila. */

export type FilaPrevisualizada = FilaImportacion & {
  /** Ids resueltos contra los catalogos; null si no se encontro. */
  proyectoId: string | null;
  categoriaId: string | null;
  metodoPagoId: string | null;
  /** true si la fila se puede importar tal cual. */
  importable: boolean;
};

export type Previsualizacion = {
  filas: FilaPrevisualizada[];
  columnasDesconocidas: string[];
  columnasFaltantes: string[];
  resumen: {
    total: number;
    importables: number;
    conErrores: number;
    ingresos: number;
    egresos: number;
  };
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * RF-27, primera mitad: leer, resolver catalogos y devolver el diagnostico.
 *
 * No escribe nada. La resolucion es **por nombre**, no por id: el CSV lo escribe
 * una persona mirando su Excel, no exportando ids de la base, y exigirle uuids
 * volveria la funcion inutil. Las categorias se buscan por nombre de hoja o por
 * la ruta «Padre › Hija».
 */
export class PrevisualizarImportacion {
  constructor(
    private readonly proyectos: ProyectoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly metodosPago: MetodoPagoRepository,
  ) {}

  async ejecutar(entrada: {
    contenido: string;
    /** Proyecto por omision cuando la fila no trae columna `proyecto`. */
    proyectoId?: string;
  }): Promise<Previsualizacion> {
    const lectura = leerCsvDeMovimientos(entrada.contenido);

    const [proyectos, categorias, metodos] = await Promise.all([
      this.proyectos.listar({ estados: ["activo", "pausado"] }),
      this.categorias.listar({ soloActivas: true }),
      this.metodosPago.listar(true),
    ]);

    // Nada impide dos proyectos con el mismo nombre, y en ese caso resolver «por
    // nombre» seria elegir uno al azar: se marca ambiguo y la fila se rechaza.
    const proyectoPorNombre = new Map<string, string>();
    const nombresAmbiguos = new Set<string>();
    for (const proyecto of proyectos) {
      const clave = normalizar(proyecto.nombre);
      if (proyectoPorNombre.has(clave)) nombresAmbiguos.add(clave);
      else proyectoPorNombre.set(clave, proyecto.proyectoId);
    }
    const metodoPorNombre = new Map(metodos.map((m) => [normalizar(m.nombre), m.id]));
    const categoriaPorNombre = new Map<string, string>();
    for (const categoria of categorias) {
      // La ruta gana sobre el nombre suelto: dos subcategorias pueden llamarse
      // igual bajo padres distintos, y en ese caso el nombre suelto es ambiguo.
      categoriaPorNombre.set(normalizar(categoria.ruta), categoria.id);
      if (!categoriaPorNombre.has(normalizar(categoria.nombre))) {
        categoriaPorNombre.set(normalizar(categoria.nombre), categoria.id);
      }
    }

    const filas: FilaPrevisualizada[] = lectura.filas.map((fila) => {
      const errores = [...fila.errores];
      let proyectoId: string | null = entrada.proyectoId ?? null;
      let categoriaId: string | null = null;
      let metodoPagoId: string | null = null;

      if (fila.datos) {
        if (fila.datos.proyecto) {
          const clave = normalizar(fila.datos.proyecto);
          if (nombresAmbiguos.has(clave)) {
            proyectoId = null;
            errores.push(
              `Hay más de un proyecto llamado «${fila.datos.proyecto}»: elige el proyecto arriba y quita la columna.`,
            );
          } else {
            proyectoId = proyectoPorNombre.get(clave) ?? null;
            if (proyectoId === null) {
              errores.push(`No hay un proyecto activo llamado «${fila.datos.proyecto}».`);
            }
          }
        } else if (proyectoId === null) {
          errores.push("Falta el proyecto: indícalo en la columna o elígelo arriba.");
        }

        categoriaId = categoriaPorNombre.get(normalizar(fila.datos.categoria)) ?? null;
        if (categoriaId === null) {
          errores.push(`No existe la categoría «${fila.datos.categoria}».`);
        }

        if (fila.datos.metodoPago) {
          metodoPagoId = metodoPorNombre.get(normalizar(fila.datos.metodoPago)) ?? null;
          if (metodoPagoId === null) {
            errores.push(`No existe el método de pago «${fila.datos.metodoPago}».`);
          }
        }
      }

      return {
        ...fila,
        errores,
        proyectoId,
        categoriaId,
        metodoPagoId,
        importable: errores.length === 0 && fila.datos !== null,
      };
    });

    const importables = filas.filter((f) => f.importable);

    return {
      filas,
      columnasDesconocidas: lectura.columnasDesconocidas,
      columnasFaltantes: lectura.columnasFaltantes,
      resumen: {
        total: filas.length,
        importables: importables.length,
        conErrores: filas.length - importables.length,
        ingresos: importables
          .filter((f) => f.datos?.tipo === "ingreso")
          .reduce((suma, f) => suma + (f.datos?.valor ?? 0), 0),
        egresos: importables
          .filter((f) => f.datos?.tipo === "egreso")
          .reduce((suma, f) => suma + (f.datos?.valor ?? 0), 0),
      },
    };
  }
}

/**
 * RF-27, segunda mitad: importar solo las filas validas.
 *
 * Cada movimiento pasa por `RegistrarMovimiento`, no por el repositorio: las
 * invariantes de §5.7 valen igual venga de un formulario o de un archivo, y una
 * importacion que las salte es exactamente como se corrompen las cifras.
 *
 * No es transaccional a proposito: si la fila 40 falla, las 39 anteriores quedan
 * registradas y se informa cual fallo. Deshacer una carga parcial es un problema
 * peor que repetir cuatro filas, porque el borrado fisico de movimientos no
 * existe (ADR-12).
 */
export class ImportarMovimientos {
  constructor(
    private readonly previsualizar: PrevisualizarImportacion,
    private readonly registrar: RegistrarMovimiento,
  ) {}

  async ejecutar(entrada: { contenido: string; proyectoId?: string }): Promise<{
    importados: number;
    omitidos: number;
    fallidos: Array<{ numero: number; motivo: string }>;
  }> {
    const previsualizacion = await this.previsualizar.ejecutar(entrada);

    if (previsualizacion.columnasFaltantes.length > 0) {
      throw new ReglaDeNegocioViolada(
        "CSV_INVALIDO",
        `Faltan columnas obligatorias: ${previsualizacion.columnasFaltantes.join(", ")}.`,
      );
    }
    if (previsualizacion.resumen.total > MAXIMO_FILAS_CSV) {
      throw new ReglaDeNegocioViolada(
        "CSV_DEMASIADO_GRANDE",
        `El archivo tiene más de ${MAXIMO_FILAS_CSV} filas.`,
      );
    }
    if (previsualizacion.resumen.importables === 0) {
      throw new ReglaDeNegocioViolada(
        "CSV_SIN_FILAS_VALIDAS",
        "Ninguna fila del archivo se puede importar. Revisa los errores de la previsualización.",
      );
    }

    const fallidos: Array<{ numero: number; motivo: string }> = [];
    let importados = 0;

    for (const fila of previsualizacion.filas) {
      if (!fila.importable || !fila.datos || !fila.proyectoId || !fila.categoriaId) continue;

      try {
        await this.registrar.ejecutar({
          proyectoId: fila.proyectoId,
          categoriaId: fila.categoriaId,
          metodoPagoId: fila.metodoPagoId,
          tipo: fila.datos.tipo,
          fecha: fila.datos.fecha,
          fechaPago: fila.datos.estado === "pagado" ? fila.datos.fecha : null,
          valor: fila.datos.valor,
          descripcion: fila.datos.descripcion,
          observaciones: fila.datos.observaciones,
          estado: fila.datos.estado,
        });
        importados += 1;
      } catch (error) {
        fallidos.push({
          numero: fila.numero,
          motivo: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      importados,
      omitidos: previsualizacion.resumen.conErrores,
      fallidos,
    };
  }
}
