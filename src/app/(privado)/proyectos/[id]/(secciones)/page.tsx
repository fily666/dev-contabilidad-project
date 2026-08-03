import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { GraficoFlujo } from "@/shared/ui/viz/grafico-flujo";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { PanelIndicadores } from "@/modules/proyectos/presentation/components/panel-indicadores";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { TablaMovimientos } from "@/modules/movimientos/presentation/components/tabla-movimientos";

export const metadata: Metadata = { title: "Detalle del proyecto" };

type Props = { params: Promise<{ id: string }> };

/** RF-15, RF-77 y fórmulas de §5. */
export default async function PaginaProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, ajustes } = await contenedorPrivado();

  const resumen = await contenedor.proyectos.resumen.ejecutar({ proyectoId: id }).catch(() => null);

  if (!resumen) notFound();

  const { proyecto, tipo, indicadores, indicadoresVisibles, flujoMensual } = resumen;

  // El catálogo de categorías ya lo carga el layout para el diálogo de alta: aquí
  // no hace falta y era una consulta más por visita.
  const [ultimos, metodosPago, agenda] = await Promise.all([
    contenedor.movimientos.listar.ejecutar({
      filtro: { proyectoId: id },
      paginacion: { pagina: 1, porPagina: 5 },
    }),
    contenedor.metodosPago.listar.ejecutar(),
    // RF-58, RF-73 en el ámbito del proyecto: lo vencido y lo que vence en 30 días.
    contenedor.obligaciones.listarAgenda.ejecutar({
      filtro: { proyectoId: id, dentroDeDias: 30, incluirVencidas: true },
    }),
  ]);

  const hoy = contenedor.reloj.hoy();
  const atributos = Object.entries(proyecto.atributos);
  const etiquetaAtributo = new Map(tipo.configuracion.atributos.map((a) => [a.clave, a.etiqueta]));

  return (
    <div className="space-y-6">
      {/*
        La identidad del proyecto, sus acciones y las pestañas viven en el layout
        del grupo `(secciones)`: aquí solo va el contenido del resumen.
      */}
      {proyecto.descripcion ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{proyecto.descripcion}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/*
          Balance y meses de historia. Los tres anillos que acompañaban a esta
          cifra —Cobertura, Capitalizado y ROI— se retiraron: los dos primeros son
          razones derivables de las tarjetas de indicadores, y el ROI ya vive en
          `PanelIndicadores`, así que aparecía dos veces en la misma pantalla. El
          anillo además lo pintaba siempre, incluso en un tipo de proyecto que no
          declara `roi_acumulado`, contradiciendo la visibilidad por tipo de §5.4.
        */}
        <section
          aria-label="Balance del proyecto"
          className="panel panel-acento flex flex-col justify-center p-6 lg:col-span-2"
        >
          <p className="etiqueta-dato">Balance</p>
          <p className="cifra-heroe mt-2 text-4xl sm:text-5xl">
            {formatearDineroCompacto(indicadores.balance, indicadores.moneda)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresos {formatearDineroCompacto(indicadores.totalIngresos, indicadores.moneda)} −
            egresos {formatearDineroCompacto(indicadores.totalEgresos, indicadores.moneda)} ·{" "}
            {indicadores.mesesDeHistoria} {indicadores.mesesDeHistoria === 1 ? "mes" : "meses"} de
            historia.
          </p>
        </section>

        {/*
          Ficha del activo, en el hueco que quedaba a la derecha del balance.

          Los atributos iban antes en un `dl` a ancho completo con
          `sm:grid-cols-3 lg:grid-cols-5` FIJO: un inmueble declara dos atributos,
          así que tres celdas quedaban vacías a lo ancho de la pantalla. En una
          columna, dos atributos ocupan dos filas y ninguna queda vacía.
        */}
        <dl className="panel space-y-3 p-5">
          <div>
            <dt className="etiqueta-dato">Payback</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {indicadores.paybackMeses === null
                ? "Aún no recuperado"
                : `${indicadores.paybackMeses} ${indicadores.paybackMeses === 1 ? "mes" : "meses"}`}
            </dd>
          </div>
          {atributos.map(([clave, valor]) => (
            <div key={clave}>
              <dt className="etiqueta-dato">{etiquetaAtributo.get(clave) ?? clave}</dt>
              <dd className="mt-0.5 truncate text-sm font-medium">{String(valor)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <PanelGrafica
        titulo="Flujo mensual"
        descripcion="Ingresos y egresos pagados de los últimos doce meses."
        leyenda={[
          { etiqueta: "Ingresos", serie: 1 },
          { etiqueta: "Egresos", serie: 2 },
        ]}
      >
        {flujoMensual.length === 0 ? (
          <EstadoVacio
            denso
            titulo="Sin movimientos pagados"
            descripcion="Registra el primer movimiento para ver el flujo del proyecto."
          />
        ) : (
          <GraficoFlujo puntos={flujoMensual} moneda={indicadores.moneda} />
        )}
      </PanelGrafica>

      <PanelIndicadores indicadores={indicadores} visibles={indicadoresVisibles} />

      <PanelAgenda
        eventos={agenda}
        metodosPago={metodosPago}
        hoy={hoy}
        formatoFecha={ajustes.formatoFecha}
        moneda={proyecto.moneda}
        titulo="Obligaciones próximas y vencidas"
        ocultarProyecto
        vacio={{
          titulo: "Sin vencimientos en 30 días",
          descripcion: "Registra las obligaciones del proyecto para verlas aquí.",
        }}
      />

      <section className="space-y-3">
        <CabeceraSeccion
          titulo="Últimos movimientos"
          acciones={
            ultimos.total > 0 ? (
              <EnlaceBoton href={`/proyectos/${proyecto.id}/movimientos`} variant="ghost" size="sm">
                Ver todos ({ultimos.total})
              </EnlaceBoton>
            ) : null
          }
        />

        {ultimos.filas.length === 0 ? (
          <EstadoVacio
            icono={<ArrowLeftRight className="size-7" />}
            titulo="Sin movimientos todavía"
            descripcion="Registra la separación, la cuota inicial o el primer gasto para empezar a ver los indicadores."
          />
        ) : (
          <TablaMovimientos
            filas={ultimos.filas}
            metodosPago={metodosPago}
            hoy={hoy}
            formatoFecha={ajustes.formatoFecha}
            ocultarProyecto
          />
        )}
      </section>
    </div>
  );
}
