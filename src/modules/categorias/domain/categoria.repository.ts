import type { Naturaleza } from "@/shared/domain/enumeraciones";
import type { Categoria } from "./categoria.entity";

/** PUERTO (Contexto.md §7.3). */

export type FiltroCategorias = {
  /** Incluye las categorias sin tipo (transversales) y las del tipo indicado. */
  tipoProyectoId?: string | null;
  naturalezas?: Naturaleza[];
  soloActivas?: boolean;
};

/** Categoria con su ruta legible: «Adquisicion › Cuota inicial». */
export type CategoriaConRuta = {
  id: string;
  nombre: string;
  ruta: string;
  padreId: string | null;
  padreNombre: string | null;
  naturaleza: Naturaleza;
  esSistema: boolean;
  activa: boolean;
  esRaiz: boolean;
  tipoProyectoId: string | null;
};

export interface CategoriaRepository {
  buscarPorId(id: string, propietarioId: string): Promise<Categoria | null>;
  listar(propietarioId: string, filtro?: FiltroCategorias): Promise<CategoriaConRuta[]>;
  guardar(categoria: Categoria): Promise<Categoria>;
  actualizar(categoria: Categoria): Promise<Categoria>;
  eliminar(id: string, propietarioId: string): Promise<void>;
  contarMovimientos(categoriaId: string, propietarioId: string): Promise<number>;
  existeNombre(
    propietarioId: string,
    nombre: string,
    tipoProyectoId: string | null,
    padreId: string | null,
    excluirId?: string,
  ): Promise<boolean>;
}
