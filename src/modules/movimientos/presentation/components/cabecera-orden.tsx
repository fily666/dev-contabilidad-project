"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/shared/utils/cn";

/** Campos por los que `leerFiltros` admite ordenar (RF-24). */
export type CampoOrden = "fecha" | "valor" | "categoria" | "estado";

type Props = {
  campo: CampoOrden;
  children: React.ReactNode;
  /** Alinea la flecha a la derecha en las columnas numéricas. */
  alineado?: "izquierda" | "derecha";
};

/**
 * Cabecera de columna ordenable (RF-24).
 *
 * El orden ya estaba implementado de punta a punta: `leerFiltros` valida
 * `ordenCampo` y `ordenDireccion`, el repositorio los aplica y el caso de uso los
 * recibe. Lo único que faltaba era un control, así que ordenar por valor —la
 * operación más obvia de un listado de dinero— era imposible desde la interfaz.
 *
 * El estado vive en la URL como el resto de la lectura (§7.6), de modo que un
 * listado ordenado se comparte y sobrevive a una recarga.
 */
export function CabeceraOrden({ campo, children, alineado = "izquierda" }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();

  const campoActual = parametros.get("ordenCampo") ?? "fecha";
  const direccion = parametros.get("ordenDireccion") === "asc" ? "asc" : "desc";
  const activo = campoActual === campo;

  function alternar() {
    const nuevos = new URLSearchParams(parametros.toString());
    // Primer clic en una columna nueva: descendente, que es lo que se espera de
    // fechas e importes. Los siguientes alternan.
    const siguiente = activo && direccion === "desc" ? "asc" : "desc";

    if (campo === "fecha" && siguiente === "desc") nuevos.delete("ordenCampo");
    else nuevos.set("ordenCampo", campo);

    if (siguiente === "desc") nuevos.delete("ordenDireccion");
    else nuevos.set("ordenDireccion", siguiente);

    // Cambiar el orden invalida la página en la que se estaba.
    nuevos.delete("pagina");
    const consulta = nuevos.toString();
    router.push(consulta ? `?${consulta}` : "?");
  }

  const Flecha = !activo ? ChevronsUpDown : direccion === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Ordenar por ${String(children)}`}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        alineado === "derecha" && "flex-row-reverse",
        activo && "text-foreground",
      )}
    >
      {children}
      <Flecha className={cn("size-3", activo ? "opacity-100" : "opacity-40")} aria-hidden />
    </button>
  );
}
