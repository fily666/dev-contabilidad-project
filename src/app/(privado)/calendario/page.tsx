import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays, FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TIPOS_MOVIMIENTO, type TipoMovimiento } from "@/shared/domain/enumeraciones";
import { formatearDinero } from "@/shared/utils/formato";
import { claveDeMes, esClaveDeMes } from "@/modules/calendario/domain/mes";
import { NavegacionMes } from "@/modules/calendario/presentation/components/navegacion-mes";
import { RejillaMes } from "@/modules/calendario/presentation/components/rejilla-mes";

export const metadata: Metadata = { title: "Calendario" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function primero(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v : undefined;
}

/** RF-60 a RF-64. */
export default async function PaginaCalendario({ searchParams }: Props) {
  const parametros = await searchParams;
  const { contenedor } = await contenedorPrivado();

  const hoy = contenedor.reloj.hoy();
  const mesPedido = primero(parametros.mes);
  const tipoPedido = primero(parametros.tipo);

  const calendario = await contenedor.calendario.obtener.ejecutar({
    filtro: {
      mes: mesPedido && esClaveDeMes(mesPedido) ? mesPedido : claveDeMes(hoy),
      proyectoId: primero(parametros.proyectoId),
      tipo: (TIPOS_MOVIMIENTO as readonly string[]).includes(tipoPedido ?? "")
        ? (tipoPedido as TipoMovimiento)
        : undefined,
    },
  });

  const [proyectos, metodosPago] = await Promise.all([
    contenedor.proyectos.listar.ejecutar({}),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta-dato">Agenda financiera</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Vencimientos de obligaciones y movimientos, cada uno en su fecha.
          </p>
        </div>
        {/* RF-63: el total comprometido del mes, en el encabezado. */}
        <div className="text-right">
          <p className="etiqueta-dato">Comprometido del mes</p>
          <p className="cifra mt-1 text-2xl">
            {formatearDinero(calendario.comprometido, calendario.moneda)}
          </p>
        </div>
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="El calendario muestra los vencimientos de tus proyectos."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <NavegacionMes
              mes={calendario.mes}
              mesActual={claveDeMes(hoy)}
              proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
            />
          </Suspense>

          {calendario.totalEventos === 0 ? (
            <EstadoVacio
              icono={<CalendarDays className="size-8" />}
              titulo="Sin eventos este mes"
              descripcion="No hay obligaciones ni movimientos con fecha en el mes seleccionado."
            />
          ) : (
            <RejillaMes
              dias={calendario.dias}
              metodosPago={metodosPago}
              hoy={hoy}
              moneda={calendario.moneda}
            />
          )}

          <p className="text-xs text-muted-foreground">
            Color por estado: azul pendiente, rojo vencido, verde pagado, gris omitido. La flecha
            indica si es ingreso o egreso.
          </p>
        </>
      )}
    </div>
  );
}
