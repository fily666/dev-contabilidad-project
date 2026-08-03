"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/**
 * Miga de pan del shell privado.
 *
 * Sustituye a la pastilla decorativa «Datos en vivo» que ocupaba este sitio, y
 * que además no era cierta: no hay refresco en vivo ni suscripciones — §7.6
 * retiró TanStack Query justamente por eso.
 *
 * El problema que resuelve: en las ocho rutas anidadas de `/proyectos/[id]/…` no
 * había nada que dijera dónde estaba el usuario. El resaltado de la navegación
 * lateral marca «Proyectos» tanto en el listado como en el detalle como en los
 * movimientos de un proyecto, y en móvil ni se ve hasta abrir el panel. El
 * criterio es que el usuario sepa siempre dónde está, y una miga lo cumple con el
 * espacio que ya estaba gastado.
 *
 * Se construye desde la ruta y no desde un contexto: la jerarquía real del
 * producto es plana salvo dentro de un proyecto, y ahí el nombre del proyecto lo
 * pone la cabecera del `layout.tsx` de la sección, en un `h1` inmediatamente
 * debajo. Por eso el identificador de la ruta **no se pinta**: un UUID no le dice
 * nada a nadie y una etiqueta genérica como «Detalle» dice menos que el nombre que
 * ya está a la vista. Se conserva en el `href` del segmento siguiente, así que
 * ningún enlace se rompe.
 */

/** Identificadores opacos: se saltan en la miga, no en las rutas. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Etiqueta visible de cada segmento de ruta conocido. */
const ETIQUETA: Record<string, string> = {
  dashboard: "Panel",
  proyectos: "Proyectos",
  movimientos: "Movimientos",
  importar: "Importar",
  nuevo: "Nuevo",
  editar: "Editar",
  obligaciones: "Obligaciones",
  calendario: "Calendario",
  avisos: "Avisos",
  documentos: "Documentos",
  presupuestos: "Presupuestos",
  patrimonio: "Patrimonio",
  reportes: "Reportes",
  configuracion: "Configuración",
};

export function MigaDePan() {
  const ruta = usePathname();
  const segmentos = ruta.split("/").filter(Boolean);

  // En la raíz de un módulo la miga no aporta: el título de la página ya lo dice
  // y la navegación lateral lo resalta. Aparece a partir del segundo nivel.
  if (segmentos.length < 2) return null;

  const visibles = segmentos
    .map((segmento, indice) => ({
      segmento,
      href: `/${segmentos.slice(0, indice + 1).join("/")}`,
      ultimo: indice === segmentos.length - 1,
    }))
    .filter(({ segmento }) => !UUID.test(segmento));

  if (visibles.length < 2) return null;

  const migas = visibles.map((miga, indice) => ({
    ...miga,
    etiqueta: ETIQUETA[miga.segmento] ?? miga.segmento,
    ultimo: indice === visibles.length - 1,
  }));

  return (
    <nav aria-label="Ruta de navegación" className="hidden min-w-0 sm:block">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {migas.map((miga) => (
          <li key={miga.href} className="flex min-w-0 items-center gap-1">
            {miga.ultimo ? (
              // El último no es enlace: ya se está ahí, y un enlace a la página
              // actual es una promesa de movimiento que no se cumple.
              <span aria-current="page" className="truncate font-medium">
                {miga.etiqueta}
              </span>
            ) : (
              <>
                <Link
                  href={miga.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {miga.etiqueta}
                </Link>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
