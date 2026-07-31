import type { Naturaleza } from "@/shared/domain/enumeraciones";
import { Categoria } from "../domain/categoria.entity";
import type {
  CategoriaConRuta,
  CategoriaRepository,
  FiltroCategorias,
} from "../domain/categoria.repository";

/** Doble en memoria del puerto CategoriaRepository (Contexto.md §8.8). */
export class CategoriaRepositoryEnMemoria implements CategoriaRepository {
  readonly filas = new Map<string, Categoria>();
  readonly movimientosPorCategoria = new Map<string, number>();
  eliminados: string[] = [];

  constructor(iniciales: Categoria[] = []) {
    for (const categoria of iniciales) this.filas.set(categoria.id, categoria);
  }

  async buscarPorId(id: string): Promise<Categoria | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(filtro?: FiltroCategorias): Promise<CategoriaConRuta[]> {
    return [...this.filas.values()]
      .filter((c) => (filtro?.soloActivas === false ? true : c.activa))
      .filter((c) => !filtro?.naturalezas || filtro.naturalezas.includes(c.naturaleza))
      .filter(
        (c) =>
          filtro?.tipoProyectoId === undefined ||
          c.tipoProyectoId === null ||
          c.tipoProyectoId === filtro.tipoProyectoId,
      )
      .map((c) => {
        const padre = c.padreId ? this.filas.get(c.padreId) : undefined;
        return {
          id: c.id,
          nombre: c.nombre,
          ruta: padre ? `${padre.nombre} › ${c.nombre}` : c.nombre,
          padreId: c.padreId,
          padreNombre: padre?.nombre ?? null,
          naturaleza: c.naturaleza,
          esSistema: c.esSistema,
          activa: c.activa,
          esRaiz: c.esRaiz,
          tipoProyectoId: c.tipoProyectoId,
        };
      });
  }

  async guardar(categoria: Categoria): Promise<Categoria> {
    this.filas.set(categoria.id, categoria);
    return categoria;
  }

  async actualizar(categoria: Categoria): Promise<Categoria> {
    this.filas.set(categoria.id, categoria);
    return categoria;
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    this.eliminados.push(id);
  }

  async contarMovimientos(categoriaId: string): Promise<number> {
    return this.movimientosPorCategoria.get(categoriaId) ?? 0;
  }

  async existeNombre(
    nombre: string,
    tipoProyectoId: string | null,
    padreId: string | null,
    excluirId?: string,
  ): Promise<boolean> {
    return [...this.filas.values()].some(
      (c) =>
        c.id !== excluirId &&
        c.nombre.toLowerCase() === nombre.trim().toLowerCase() &&
        c.tipoProyectoId === tipoProyectoId &&
        c.padreId === padreId,
    );
  }
}

/** Categoria del catalogo, con la opcion de marcarla como fila de sistema. */
export function categoriaDePrueba(entrada: {
  id: string;
  nombre: string;
  naturaleza: Naturaleza;
  tipoProyectoId?: string | null;
  padreId?: string | null;
  esSistema?: boolean;
  activa?: boolean;
}): Categoria {
  if (entrada.esSistema || entrada.activa === false) {
    return Categoria.desdePersistencia({
      id: entrada.id,
      tipoProyectoId: entrada.tipoProyectoId ?? null,
      padreId: entrada.padreId ?? null,
      nombre: entrada.nombre,
      naturaleza: entrada.naturaleza,
      esSistema: entrada.esSistema ?? false,
      activa: entrada.activa ?? true,
      orden: 0,
    });
  }

  return Categoria.crear({
    id: entrada.id,
    nombre: entrada.nombre,
    naturaleza: entrada.naturaleza,
    tipoProyectoId: entrada.tipoProyectoId ?? null,
    padreId: entrada.padreId ?? null,
  });
}
