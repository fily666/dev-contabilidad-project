"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, BellRing, FileText, LayoutDashboard, Scale } from "lucide-react";

import { cn } from "@/shared/utils/cn";

/**
 * Secciones de un proyecto (Contexto.md §7.2), persistentes.
 *
 * **Persistentes es el requisito, no un detalle de estilo:** una navegación que
 * desaparece al usarla convierte el salto entre dos secciones del mismo proyecto
 * en dos clics —pasando por el detalle— donde debe haber uno.
 *
 * Viven en el `layout.tsx` del grupo de secciones, así que se pintan una vez y no
 * cinco, y la cabecera del proyecto se escribe también una sola vez.
 */
const SECCIONES = [
  { sufijo: "", etiqueta: "Resumen", icono: LayoutDashboard },
  { sufijo: "/movimientos", etiqueta: "Movimientos", icono: ArrowLeftRight },
  { sufijo: "/obligaciones", etiqueta: "Obligaciones", icono: BellRing },
  { sufijo: "/documentos", etiqueta: "Documentos", icono: FileText },
  { sufijo: "/patrimonio", etiqueta: "Patrimonio", icono: Scale },
] as const;

export function PestanasProyecto({ proyectoId }: { proyectoId: string }) {
  const ruta = usePathname();
  const base = `/proyectos/${proyectoId}`;

  return (
    // Mismo patrón que `TabsList` (RNF-01): el desborde se resuelve DENTRO del
    // contenedor con `overflow-x-auto` y una lista `w-fit`, para que a 375 px las
    // pestañas sigan alcanzables sin que el documento gane scroll horizontal.
    // `min-w-0` es imprescindible: sin él el padre no deja encoger al hijo.
    <nav
      aria-label="Secciones del proyecto"
      className="-mx-1 max-w-full min-w-0 [scrollbar-width:none] overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-fit items-center gap-1 border-b border-border/70">
        {SECCIONES.map(({ sufijo, etiqueta, icono: Icono }) => {
          const href = `${base}${sufijo}`;
          const activo = ruta === href;

          return (
            <li key={etiqueta}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  activo
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icono
                  className={cn("size-4 shrink-0", activo ? "text-neon" : "opacity-70")}
                  aria-hidden
                />
                {etiqueta}
                {activo ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-neon shadow-[0_0_10px_var(--neon-brillo)]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
