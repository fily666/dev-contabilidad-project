import { redirect } from "next/navigation";

import { contenedorDeAcceso } from "@/di/container";
import { BarraSuperior } from "@/shared/ui/barra-superior";
import { NavegacionLateral } from "@/shared/ui/navegacion-lateral";

/**
 * Shell privado (Contexto.md §7.2). Guardia de sesion: el middleware ya
 * redirige, aqui se verifica de nuevo antes de renderizar datos (§9).
 */
export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const acceso = await contenedorDeAcceso();

  if (!(await acceso.verificar.haySesion())) redirect("/acceso");

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
        <div className="sticky top-0 h-svh overflow-y-auto">
          <NavegacionLateral />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior />
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
