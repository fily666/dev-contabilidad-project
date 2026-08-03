import { redirect } from "next/navigation";

import { contenedorDeAcceso, contenedorPrivado } from "@/di/container";
import { BarraSuperior } from "@/shared/ui/barra-superior";
import { NavegacionLateral } from "@/shared/ui/navegacion-lateral";
import { DefinicionesGraficas } from "@/shared/ui/viz/definiciones";
import { formatearInstante } from "@/shared/utils/formato";
import { CampanaAvisos } from "@/modules/notificaciones/presentation/components/campana-avisos";

/**
 * Shell privado (Contexto.md §7.2). Guardia de sesion: el middleware ya
 * redirige, aqui se verifica de nuevo antes de renderizar datos (§9).
 */
export default async function LayoutPrivado({ children }: { children: React.ReactNode }) {
  const acceso = await contenedorDeAcceso();

  if (!(await acceso.verificar.haySesion())) redirect("/acceso");

  // §10.2, RF-59: la campana vive en el shell, asi que su bandeja se consulta
  // aqui —una vez por navegacion, en el servidor— y no en cada pagina. Diez
  // avisos: es una vista previa, y el historial completo esta en /avisos.
  //
  // Esto agrega una lectura de `ajustes` por navegacion, porque la pagina de
  // debajo tambien llama a `contenedorPrivado()`. Se acepta a cambio de no
  // memoizar el contenedor: `cache()` lo dedupliparia, pero tambien devolveria
  // ajustes viejos en el re-render que sigue a una Server Action que acaba de
  // cambiarlos —la pantalla de Configuracion mostraria lo anterior—. Una consulta
  // de una fila por indice es mas barata que ese error.
  const { contenedor, ajustes } = await contenedorPrivado();
  const bandeja = await contenedor.notificaciones.bandeja.ejecutar({ limite: 10 });

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
        <BarraSuperior
          campana={
            <CampanaAvisos
              noLeidos={bandeja.noLeidos}
              avisos={bandeja.avisos.map((aviso) => ({
                id: aviso.id,
                asunto: aviso.asunto,
                cuerpo: aviso.cuerpo,
                cuando: formatearInstante(aviso.programadaPara, ajustes.zonaHoraria),
                leido: aviso.leidaEn !== null,
              }))}
            />
          }
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
