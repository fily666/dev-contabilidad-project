import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Naturaleza } from "@/shared/domain/enumeraciones";
import { Categoria } from "../domain/categoria.entity";
import type {
  CategoriaConRuta,
  CategoriaRepository,
  FiltroCategorias,
} from "../domain/categoria.repository";

/** RF-30: catalogo disponible para un proyecto. */
export class ListarCategorias {
  constructor(private readonly categorias: CategoriaRepository) {}

  async ejecutar(entrada: { filtro?: FiltroCategorias }): Promise<CategoriaConRuta[]> {
    return this.categorias.listar(entrada.filtro);
  }
}

/** RF-31. */
export class CrearCategoria {
  constructor(
    private readonly categorias: CategoriaRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: {
    nombre: string;
    naturaleza: Naturaleza;
    tipoProyectoId?: string | null;
    padreId?: string | null;
  }): Promise<Categoria> {
    const padre = entrada.padreId ? await this.categorias.buscarPorId(entrada.padreId) : null;

    if (entrada.padreId && !padre) {
      throw new NoEncontrado("categoria padre", entrada.padreId);
    }
    if (padre && !padre.esRaiz) {
      throw new ReglaDeNegocioViolada(
        "JERARQUIA_INVALIDA",
        "Solo se admiten dos niveles: categoria y subcategoria.",
        "padreId",
      );
    }
    // La subcategoria hereda la naturaleza del padre para no romper el
    // significado de las cifras (ADR-06).
    const naturaleza = padre ? padre.naturaleza : entrada.naturaleza;
    const tipoProyectoId = padre ? padre.tipoProyectoId : (entrada.tipoProyectoId ?? null);

    const duplicada = await this.categorias.existeNombre(
      entrada.nombre.trim(),
      tipoProyectoId,
      entrada.padreId ?? null,
    );
    if (duplicada) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_DUPLICADA",
        "Ya existe una categoria con ese nombre.",
        "nombre",
      );
    }

    const categoria = Categoria.crear({
      id: this.nuevoId(),
      tipoProyectoId,
      padreId: entrada.padreId ?? null,
      nombre: entrada.nombre,
      naturaleza,
    });

    return this.categorias.guardar(categoria);
  }
}

/** RF-31. */
export class ActualizarCategoria {
  constructor(private readonly categorias: CategoriaRepository) {}

  async ejecutar(entrada: {
    id: string;
    nombre: string;
    naturaleza?: Naturaleza;
  }): Promise<Categoria> {
    const categoria = await this.categorias.buscarPorId(entrada.id);
    if (!categoria) throw new NoEncontrado("categoria", entrada.id);

    const duplicada = await this.categorias.existeNombre(
      entrada.nombre.trim(),
      categoria.tipoProyectoId,
      categoria.padreId,
      categoria.id,
    );
    if (duplicada) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_DUPLICADA",
        "Ya existe una categoria con ese nombre.",
        "nombre",
      );
    }

    categoria.renombrar(entrada.nombre);
    if (entrada.naturaleza && categoria.esRaiz) {
      categoria.cambiarNaturaleza(entrada.naturaleza);
    }

    return this.categorias.actualizar(categoria);
  }
}

/** RF-31, RF-34. */
export class CambiarEstadoCategoria {
  constructor(private readonly categorias: CategoriaRepository) {}

  async ejecutar(entrada: { id: string; activa: boolean }): Promise<Categoria> {
    const categoria = await this.categorias.buscarPorId(entrada.id);
    if (!categoria) throw new NoEncontrado("categoria", entrada.id);

    if (entrada.activa) categoria.activar();
    else categoria.desactivar();

    return this.categorias.actualizar(categoria);
  }
}

/** RF-34: nunca se elimina una categoria en uso ni una del sistema. */
export class EliminarCategoria {
  constructor(private readonly categorias: CategoriaRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const categoria = await this.categorias.buscarPorId(entrada.id);
    if (!categoria) throw new NoEncontrado("categoria", entrada.id);

    if (categoria.esSistema) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_DEL_SISTEMA",
        "Las categorias del sistema no se pueden eliminar; puedes ocultarlas.",
      );
    }

    const enUso = await this.categorias.contarMovimientos(entrada.id);
    if (enUso > 0) {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_EN_USO",
        `La categoria tiene ${enUso} movimiento(s) asociado(s): desactivala en lugar de eliminarla.`,
      );
    }

    await this.categorias.eliminar(entrada.id);
  }
}
