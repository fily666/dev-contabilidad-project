import {
  ESTADOS_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
  type EstadoMovimiento,
  type TipoMovimiento,
} from "@/shared/domain/enumeraciones";
import { TIPOS_REPORTE, type TipoReporte } from "../domain/reporte";
import type { FiltroReporte } from "../application/casos-de-uso";

export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

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

/** RF-90 a RF-95: los filtros del reporte viajan en la URL y en la exportación. */
export function leerFiltroReporte(parametros: ParametrosBusqueda): {
  tipo: TipoReporte;
  filtro: FiltroReporte;
} {
  const tipoCrudo = primero(parametros.reporte) ?? "movimientos";
  const desde = primero(parametros.desde);
  const hasta = primero(parametros.hasta);

  return {
    tipo: (TIPOS_REPORTE as readonly string[]).includes(tipoCrudo)
      ? (tipoCrudo as TipoReporte)
      : "movimientos",
    filtro: {
      proyectoId: primero(parametros.proyectoId),
      desde: desde && FECHA.test(desde) ? desde : undefined,
      hasta: hasta && FECHA.test(hasta) ? hasta : undefined,
      tipos: lista<TipoMovimiento>(parametros.tipos, TIPOS_MOVIMIENTO),
      estados: lista<EstadoMovimiento>(parametros.estados, ESTADOS_MOVIMIENTO),
    },
  };
}

/** Reconstruye la cadena de consulta para los enlaces de exportación. */
export function consultaDeExportacion(tipo: TipoReporte, filtro: FiltroReporte): string {
  const parametros = new URLSearchParams({ reporte: tipo });
  if (filtro.proyectoId) parametros.set("proyectoId", filtro.proyectoId);
  if (filtro.desde) parametros.set("desde", filtro.desde);
  if (filtro.hasta) parametros.set("hasta", filtro.hasta);
  if (filtro.tipos?.length) parametros.set("tipos", filtro.tipos.join(","));
  if (filtro.estados?.length) parametros.set("estados", filtro.estados.join(","));
  return parametros.toString();
}
