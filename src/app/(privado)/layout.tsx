import { redirect } from "next/navigation";

import { contenedorDeAcceso } from "@/di/container";
import { BarraSuperior } from "@/shared/ui/barra-superior";
import { NavegacionLateral } from "@/shared/ui/navegacion-lateral";
import { DefinicionesGraficas } from "@/shared/ui/viz/definiciones";

/**
 * Shell privado (Contexto.md §7.2). Guardia de sesion: el middleware ya
 * redirige, aqui se verifica de nuevo antes de renderizar datos (§9).
 */
export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const acceso = await contenedorDeAcceso();

  if (!(await acceso.verificar.haySesion())) redirect("/acceso");

  return (
    <div className="relative flex min-h-svh">
      {/* Fondo del tablero: rejilla y halos. Fijo para que no se repinte al desplazar. */}
      <div aria-hidden className="fondo-tablero pointer-events-none fixed inset-0 -z-10" />
      <DefinicionesGraficas />

      <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-sidebar/60 backdrop-blur-xl md:block">
        <div className="sticky top-0 h-svh overflow-y-auto">
          <NavegacionLateral />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
