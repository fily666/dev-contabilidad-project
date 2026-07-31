import type { CategoriaConRuta } from "./categoria.repository";

/**
 * Catalogo que puede usar un proyecto: las categorias de su tipo mas las
 * transversales (`tipoProyectoId` nulo), que sirven para cualquiera.
 *
 * Sin este recorte, las pantallas que eligen el proyecto dentro del formulario
 * ofrecian el catalogo completo y las raices se repetian en el desplegable:
 * «Adquisición» existe en inmueble y en vehiculo, «Operación» en vehiculo y en
 * negocio. Con `tipoProyectoId` indefinido no se filtra, porque las pantallas de
 * un solo proyecto ya reciben las categorias acotadas desde el servidor.
 */
export function categoriasDelTipo(
  categorias: CategoriaConRuta[],
  tipoProyectoId: string | undefined,
): CategoriaConRuta[] {
  if (!tipoProyectoId) return categorias;
  return categorias.filter((c) => c.tipoProyectoId === null || c.tipoProyectoId === tipoProyectoId);
}

/**
 * Si la categoria elegida sigue valiendo al cambiar de proyecto. Se responde que
 * si cuando no hay con que decidir: sin categoria, sin tipo, o si la categoria
 * ya no esta en la lista.
 */
export function sirveParaTipo(
  categorias: CategoriaConRuta[],
  categoriaId: string,
  tipoProyectoId: string | undefined,
): boolean {
  if (!tipoProyectoId || !categoriaId) return true;
  const categoria = categorias.find((c) => c.id === categoriaId);
  if (!categoria) return true;
  return categoria.tipoProyectoId === null || categoria.tipoProyectoId === tipoProyectoId;
}
