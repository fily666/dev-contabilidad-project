import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/shared/domain/enumeraciones";
import type { FiltroDocumentos } from "../domain/documento.repository";

export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function primero(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v : undefined;
}

/**
 * RF-47, RNF-09: los filtros documentales viven en la URL, igual que los de
 * movimientos, para que una búsqueda se pueda compartir tal cual.
 */
export function leerFiltrosDocumentos(parametros: ParametrosBusqueda): FiltroDocumentos {
  const desde = primero(parametros.desde);
  const hasta = primero(parametros.hasta);
  const crudos = Array.isArray(parametros.tipos)
    ? parametros.tipos
    : parametros.tipos
      ? parametros.tipos.split(",")
      : [];
  const tipos = crudos.filter((t): t is TipoDocumento =>
    (TIPOS_DOCUMENTO as readonly string[]).includes(t),
  );

  return {
    proyectoId: primero(parametros.proyectoId),
    tipos: tipos.length > 0 ? tipos : undefined,
    desde: desde && FECHA.test(desde) ? desde : undefined,
    hasta: hasta && FECHA.test(hasta) ? hasta : undefined,
    texto: primero(parametros.texto),
  };
}
