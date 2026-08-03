"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  BellRing,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  Scale,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

/**
 * Ya no hay bandera `proximamente`: existió para mostrar deshabilitados los
 * módulos de fases posteriores, y las cinco fases están implementadas, así que
 * los once enlaces están vivos. Se retiró junto con su rama de render, que eran
 * catorce líneas que ningún enlace alcanzaba.
 */
type Enlace = {
  href: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
};

/**
 * Los módulos de §4 y §14, en cuatro grupos por la pregunta que responden.
 *
 * Eran once entradas planas bajo un único rótulo «Módulos», ordenadas por fase de
 * implementación —que es historia del proyecto, no una categoría del producto—.
 * Once destinos indistinguibles obligan a leer la lista entera para encontrar uno,
 * y la lista entera es lo primero que se ve en cada pantalla.
 *
 * Los grupos son cuatro y no tres porque la distinción que importa es temporal:
 * **Registro** es lo que ya pasó, **Compromisos** lo que va a pasar y **Análisis**
 * la lectura de ambos. Avisos entra en Compromisos junto a lo que los origina, y
 * no al final de la lista como estaba: un aviso sin la obligación que lo genera no
 * se entiende, y buscarlo cinco entradas más abajo era buscarlo dos veces.
 */
const GRUPOS: Array<{ titulo: string; enlaces: Enlace[] }> = [
  {
    titulo: "Análisis",
    enlaces: [
      { href: "/dashboard", etiqueta: "Panel", icono: LayoutDashboard },
      { href: "/patrimonio", etiqueta: "Patrimonio", icono: Scale },
      { href: "/reportes", etiqueta: "Reportes", icono: FileSpreadsheet },
    ],
  },
  {
    titulo: "Registro",
    enlaces: [
      { href: "/proyectos", etiqueta: "Proyectos", icono: FolderKanban },
      { href: "/movimientos", etiqueta: "Movimientos", icono: ArrowLeftRight },
      { href: "/documentos", etiqueta: "Documentos", icono: FileText },
    ],
  },
  {
    titulo: "Compromisos",
    enlaces: [
      { href: "/obligaciones", etiqueta: "Obligaciones", icono: BellRing },
      { href: "/calendario", etiqueta: "Calendario", icono: CalendarDays },
      { href: "/presupuestos", etiqueta: "Presupuestos", icono: PiggyBank },
      // RF-59: avisos ya emitidos sobre esos compromisos (§10.2).
      { href: "/avisos", etiqueta: "Avisos", icono: Bell },
    ],
  },
  {
    titulo: "Sistema",
    enlaces: [{ href: "/configuracion", etiqueta: "Configuración", icono: Settings }],
  },
];

export function NavegacionLateral({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();

  return (
    <nav aria-label="Navegación principal" className="flex h-full flex-col gap-1 p-3">
      <Link
        href="/dashboard"
        onClick={alNavegar}
        className="mb-5 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent/50"
      >
        <span className="brillo-neon flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon/25 to-neon-2/25 text-neon">
          <Wallet className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">Gestor Financiero</span>
          <span className="etiqueta-dato block truncate">Panel de control</span>
        </span>
      </Link>

      {GRUPOS.map((grupo, indice) => (
        <div key={grupo.titulo} className={cn("flex flex-col gap-1", indice > 0 && "mt-4")}>
          <p className="etiqueta-dato px-3 pb-1">{grupo.titulo}</p>

          {grupo.enlaces.map(({ href, etiqueta, icono: Icono }) => {
            const activo = ruta === href || ruta.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                onClick={alNavegar}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  activo
                    ? "bg-gradient-to-r from-neon/12 to-transparent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {activo ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-neon shadow-[0_0_12px_var(--neon-brillo)]"
                  />
                ) : null}
                <Icono className={cn("size-4 shrink-0", activo && "text-neon")} aria-hidden />
                <span className="truncate">{etiqueta}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
