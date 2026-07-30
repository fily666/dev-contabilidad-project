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

      <p className="etiqueta-dato px-3 pb-1">Módulos</p>

      {ENLACES.map(({ href, etiqueta, icono: Icono, proximamente }) => {
        const activo = ruta === href || ruta.startsWith(`${href}/`);

        if (proximamente) {
          return (
            <span
              key={href}
              aria-disabled
              title="Disponible en una fase posterior"
              className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
            >
              <Icono className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{etiqueta}</span>
              <span className="ml-auto rounded-full border border-border px-1.5 text-[9px] tracking-[0.14em] uppercase">
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
    </nav>
  );
}
