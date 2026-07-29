import {
  ESTADOS_MOVIMIENTO,
  NATURALEZAS,
  TIPOS_MOVIMIENTO,
  type EstadoMovimiento,
  type Naturaleza,
  type TipoMovimiento,
} from "@/shared/domain/enumeraciones";
import type { FiltroMovimientos, OrdenMovimientos } from "../domain/movimiento.repository";

export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

function primero(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v : undefined;
}

function lista<T extends string>(
  valor: string | string[] | undefined,
  permitidos: readonly T[],
): T[] | undefined {
  const crudo = Array.isArray(valor) ? valor : valor ? valor.split(",") : [];
  const validos = crudo.filter((v): v is T => (permitidos as readonly string[]).includes(v));
  return validos.length > 0 ? validos : undefined;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Traduce los parametros de la URL a filtros del dominio (RF-23, RNF-09).
 * Ignora silenciosamente cualquier valor no reconocido.
 */
export function leerFiltros(parametros: ParametrosBusqueda): {
  filtro: FiltroMovimientos;
  orden: OrdenMovimientos;
  pagina: number;
  porPagina: number;
} {
  const desde = primero(parametros.desde);
  const hasta = primero(parametros.hasta);

  const filtro: FiltroMovimientos = {
    proyectoId: primero(parametros.proyectoId),
    desde: desde && FECHA.test(desde) ? desde : undefined,
    hasta: hasta && FECHA.test(hasta) ? hasta : undefined,
    tipos: lista<TipoMovimiento>(parametros.tipos, TIPOS_MOVIMIENTO),
    naturalezas: lista<Naturaleza>(parametros.naturalezas, NATURALEZAS),
    estados: lista<EstadoMovimiento>(parametros.estados, ESTADOS_MOVIMIENTO),
    categoriaIds: Array.isArray(parametros.categoriaIds)
      ? parametros.categoriaIds
      : parametros.categoriaIds
        ? parametros.categoriaIds.split(",")
        : undefined,
    metodoPagoId: primero(parametros.metodoPagoId),
    texto: primero(parametros.texto),
  };

  const campo = primero(parametros.ordenCampo);
  const direccion = primero(parametros.ordenDireccion);

  const orden: OrdenMovimientos = {
    campo: campo === "valor" || campo === "categoria" || campo === "estado" ? campo : "fecha",
    direccion: direccion === "asc" ? "asc" : "desc",
  };

  const pagina = Number.parseInt(primero(parametros.pagina) ?? "1", 10);
  const porPagina = Number.parseInt(primero(parametros.porPagina) ?? "25", 10);

  return {
    filtro,
    orden,
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
    porPagina: Number.isFinite(porPagina) && porPagina > 0 ? Math.min(porPagina, 100) : 25,
  };
}
