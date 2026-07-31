import type { FiltroPanel } from "../domain/dashboard.repository";

export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function primero(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v : undefined;
}

/**
 * RF-79: el selector de rango y de proyecto aplica a todo el panel y viaja en la
 * URL, de modo que un panel filtrado se pueda compartir o recargar (RNF-09).
 */
export function leerFiltroPanel(
  parametros: ParametrosBusqueda,
  porOmision: { desde: string; hasta: string },
): FiltroPanel {
  const desde = primero(parametros.desde);
  const hasta = primero(parametros.hasta);

  return {
    proyectoId: primero(parametros.proyectoId),
    desde: desde && FECHA.test(desde) ? desde : porOmision.desde,
    hasta: hasta && FECHA.test(hasta) ? hasta : porOmision.hasta,
  };
}
