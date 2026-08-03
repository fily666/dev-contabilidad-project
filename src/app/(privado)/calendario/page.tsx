import { Suspense } from "react";
import type { Metadata } from "next";
import { AlertTriangle, CalendarDays, CheckCircle2, FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { TIPOS_MOVIMIENTO, type TipoMovimiento } from "@/shared/domain/enumeraciones";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { claveDeMes, esClaveDeMes } from "@/modules/calendario/domain/mes";
import { LeyendaCalendario } from "@/modules/calendario/presentation/components/leyenda-calendario";
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

  // Las tres lecturas son independientes: el calendario no necesita la lista de
  // proyectos ni los métodos de pago, y esperar a que acabe para pedirlos costaba
  // una ida y vuelta entera a la base en cada cambio de mes.
  const [calendario, proyectos, metodosPago] = await Promise.all([
    contenedor.calendario.obtener.ejecutar({
      filtro: {
        mes: mesPedido && esClaveDeMes(mesPedido) ? mesPedido : claveDeMes(hoy),
        proyectoId: primero(parametros.proyectoId),
        tipo: (TIPOS_MOVIMIENTO as readonly string[]).includes(tipoPedido ?? "")
          ? (tipoPedido as TipoMovimiento)
          : undefined,
      },
    }),
    contenedor.proyectos.listar.ejecutar({}),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const { resumen, moneda } = calendario;

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Agenda financiera"
        titulo="Calendario"
        descripcion="Vencimientos de obligaciones y movimientos, cada uno en su fecha."
      />

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="El calendario muestra los vencimientos de tus proyectos."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          {/*
            Tres cifras del mes donde había una.
            RF-63 pedía el comprometido y era el único número de la vista: iba
            suelto a la derecha del título, con su propia tipografía, sin ser una
            tarjeta como en las nueve vistas restantes. Lo vencido se pintaba en
            rojo celda a celda y no se sumaba en ninguna parte, así que «¿cuánto
            llevo vencido este mes?» se contestaba contando cuadros en una rejilla
            de seis semanas.
          */}
          <div className="grid gap-3 sm:grid-cols-3">
            <TarjetaIndicador
              etiqueta="Comprometido del mes"
              valor={formatearDineroCompacto(resumen.comprometido, moneda)}
              detalle="Pendiente y vencido con fecha en el mes"
              icono={<CalendarDays className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Vencido del mes"
              valor={formatearDineroCompacto(resumen.importeVencido, moneda)}
              detalle={
                resumen.vencidos > 0
                  ? `${resumen.vencidos} evento(s) pasados de fecha`
                  : "Nada pasado de fecha"
              }
              tono={resumen.vencidos > 0 ? "negativo" : "positivo"}
              icono={<AlertTriangle className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Ejecutado del mes"
              valor={formatearDineroCompacto(resumen.pagado, moneda)}
              detalle={`${resumen.eventos} evento(s) en el mes`}
              icono={<CheckCircle2 className="size-4" />}
            />
          </div>

          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <NavegacionMes
              mes={calendario.mes}
              mesActual={claveDeMes(hoy)}
              proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
            />
          </Suspense>

          {/*
            La leyenda va ANTES de la rejilla y con las muestras de color de
            verdad. Era un párrafo al final de la página que nombraba los colores
            por escrito —«azul pendiente, rojo vencido»— debajo de la rejilla que
            explicaba, y por tanto después de haberla leído sin clave. Y se pintaba
            también con la rejilla vacía, explicando colores que no había.
          */}
          {calendario.totalEventos === 0 ? (
            <EstadoVacio
              icono={<CalendarDays className="size-8" />}
              titulo="Sin eventos este mes"
              descripcion="No hay obligaciones ni movimientos con fecha en el mes seleccionado."
            />
          ) : (
            <>
              <LeyendaCalendario />
              <RejillaMes
                dias={calendario.dias}
                metodosPago={metodosPago}
                hoy={hoy}
                moneda={moneda}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
