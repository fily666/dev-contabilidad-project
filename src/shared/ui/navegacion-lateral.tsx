"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BellRing,
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

type Enlace = {
  href: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Módulos de fases posteriores: visibles pero deshabilitados. */
  proximamente?: boolean;
};

/** Estructura de modulos de Contexto.md §4 y §14. */
const ENLACES: Enlace[] = [
  { href: "/dashboard", etiqueta: "Dashboard", icono: LayoutDashboard },
  { href: "/proyectos", etiqueta: "Proyectos", icono: FolderKanban },
  { href: "/movimientos", etiqueta: "Movimientos", icono: ArrowLeftRight },
  { href: "/obligaciones", etiqueta: "Obligaciones", icono: BellRing, proximamente: true },
  { href: "/calendario", etiqueta: "Calendario", icono: CalendarDays, proximamente: true },
  { href: "/documentos", etiqueta: "Documentos", icono: FileText, proximamente: true },
  { href: "/presupuestos", etiqueta: "Presupuestos", icono: PiggyBank, proximamente: true },
  { href: "/reportes", etiqueta: "Reportes", icono: FileText, proximamente: true },
  { href: "/configuracion", etiqueta: "Configuración", icono: Settings },
];

export function NavegacionLateral({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();

  return (
    <nav aria-label="Navegación principal" className="flex h-full flex-col gap-1 p-3">
      <Link
        href="/dashboard"
        onClick={alNavegar}
        className="mb-3 flex items-center gap-2 px-2 py-1 font-semibold"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wallet className="size-4" aria-hidden />
        </span>
        <span className="truncate">Gestor Financiero</span>
      </Link>

      {ENLACES.map(({ href, etiqueta, icono: Icono, proximamente }) => {
        const activo = ruta === href || ruta.startsWith(`${href}/`);

        if (proximamente) {
          return (
            <span
              key={href}
              aria-disabled
              title="Disponible en una fase posterior"
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
            >
              <Icono className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{etiqueta}</span>
              <span className="ml-auto rounded border border-border px-1 text-[10px] tracking-wide uppercase">
                pronto
              </span>
            </span>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            onClick={alNavegar}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              activo
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icono className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{etiqueta}</span>
          </Link>
        );
      })}
    </nav>
  );
}
