import { Suspense } from "react";
import type { Metadata } from "next";
import { Banknote, FileDown, FolderKanban, Landmark, Plus, Receipt, Scale } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina, CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { Skeleton } from "@/shared/ui/skeleton";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto, formatearMes } from "@/shared/utils/formato";
import { BarrasRanking } from "@/shared/ui/viz/barras-ranking";
import { GraficoFlujo } from "@/shared/ui/viz/grafico-flujo";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { TablaCartera } from "@/modules/proyectos/presentation/components/tabla-cartera";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { FiltrosPanel } from "@/modules/dashboard/presentation/components/filtros-panel";
import {
  leerFiltroPanel,
  type ParametrosBusqueda,
} from "@/modules/dashboard/presentation/leer-filtros";

// «Panel» en el título, en el `h1`, en la miga y en la navegación lateral. La
// misma vista se llamaba «Dashboard» en el menú, «Panel» en la miga de pan,
// «Panel general» en la línea de ámbito y «Resumen» en el `h1`: cuatro nombres
// para una pantalla, y ninguno coincidía con el que el usuario acababa de pulsar.
export const metadata: Metadata = { title: "Panel" };

type Props = { searchParams: Promise<ParametrosBusqueda> };

/** Categorías que se listan antes de agrupar el resto en «otras». */
const CATEGORIAS_VISIBLES = 8;

/**
 * Vencimientos listados en el panel de agenda.
 *
 * Tres es lo medido a 1440 px: la fila queda en ~530 px con un trazo de ~400 px,
 * que es la proporción en la que doce puntos mensuales se leen —una serie temporal
 * pide ancho, no alto—. Sin tope la agenda llegaba a 693 px y arrastraba a la
 * gráfica con ella.
 *
 * **El tope recorta filas, no cifras:** los tres grupos siguen mostrando su
 * conteo y su subtotal de la ventana completa, así que lo que se lee sigue
 * sumando, y el pie enlaza el resto en `/obligaciones`.
 */
const AGENDA_EN_PANEL = 3;

/**
 * RF-70 a RF-79.
 *
 * Todas las cifras vienen del caso de uso `ObtenerPanel`, que las lee de las
 * vistas de §6.4. La pagina no suma nada por su cuenta: antes calculaba los
 * totales recorriendo los proyectos, y eso era una segunda definicion de cada
 * cifra esperando a discrepar de la del resumen de proyecto (ADR-11).
 *
 * **La vista responde tres preguntas y en este orden:** qué está pasando (los
 * cuatro totales), qué cambió (su variación contra el periodo anterior) y qué
 * requiere atención (la agenda, a la derecha del flujo y no en el cuarto bloque).
 *
 * Lo que se retiró y por qué, porque es la mitad del trabajo:
 *
 * - **La sección héroe completa** —cifra protagonista, dos medidores lineales y
 *   tres anillos—. Sus seis componentes repetían cinco indicadores que la fila de
 *   tarjetas ya daba: el balance, la razón ingresos/flujo, la de egresos/flujo, la
 *   cobertura y el capitalizado. Eran dos gramáticas visuales para lo mismo.
 * - **Los cuatro medidores de pie** de las tarjetas, por el mismo motivo: con los
 *   cuatro totales en línea, las proporciones se leen directamente.
 * - **El anillo «Activos»**, que metía un conteo en una fila de anillos
 *   porcentuales y cuyo arco no era comparable con sus vecinos. Además el término
 *   colisionaba con «Activos» de Patrimonio, que son los bienes.
 * - **El panel «Evolución del gasto»**, cuyas dos series salían de la misma serie
 *   mensual que ya dibuja el flujo ejecutado.
 * - **El panel de rentabilidad y las seis tarjetas de proyecto** → una sola tabla
 *   de cartera (RF-74 + RF-77), que además sí permite comparar.
 * - **Uno de los dos paneles de agenda**: el de vencidas estaba casi siempre vacío
 *   y dejaba ~280 px muertos. Ahora es un panel con grupos por urgencia.
 */
export default async function PaginaDashboard({ searchParams }: Props) {
  const parametros = await searchParams;
  const { contenedor, ajustes } = await contenedorPrivado();

  const filtro = leerFiltroPanel(parametros, contenedor.dashboard.panel.rangoPorOmision());
  const [panel, metodosPago] = await Promise.all([
    contenedor.dashboard.panel.ejecutar({ filtro }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const { totales, variacion, proyectos } = panel;
  const moneda = totales.moneda;
  const hoy = contenedor.reloj.hoy();

  // §5.5: el semáforo de cada proyecto, con tres lecturas agregadas para toda la
  // cartera. Se pide después del panel porque necesita la lista de proyectos.
  const semaforos = await contenedor.dashboard.semaforos.ejecutar(
    proyectos.map((p) => ({ proyectoId: p.proyectoId, tipoProyectoId: p.tipoProyectoId })),
  );

  // N-05: el filtro del panel viaja a /reportes, que usa los mismos nombres.
  const consultaDelPanel = new URLSearchParams(
    Object.entries({
      proyectoId: filtro.proyectoId,
      desde: filtro.desde,
      hasta: filtro.hasta,
    }).filter((par): par is [string, string] => Boolean(par[1])),
  ).toString();

  // H-08: el acumulado del rango se calculaba en cada carga y no se pintaba en
  // ninguna parte. Es la cifra que responde «¿voy recuperando lo que puse?».
  const acumuladoFinal = panel.flujoAcumulado.at(-1)?.acumulado ?? 0;

  // El ranking de gastos con cola agrupada: veinte categorías en un gráfico de
  // barras no se leen, y las que importan son siempre las primeras.
  const gastos = panel.gastosPorCategoria;
  const visibles = gastos.slice(0, CATEGORIAS_VISIBLES);
  const cola = gastos.slice(CATEGORIAS_VISIBLES);
  const filasGasto = [
    ...visibles.map((g) => ({ clave: g.categoriaId, etiqueta: g.categoria, valor: g.total })),
    ...(cola.length > 0
      ? [
          {
            clave: "__otras__",
            etiqueta: `Otras ${cola.length} categorías`,
            valor: cola.reduce((suma, g) => suma + g.total, 0),
          },
        ]
      : []),
  ];

  const agenda = [...panel.obligacionesVencidas, ...panel.proximosPagos];

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Resumen general"
        titulo="Panel"
        descripcion="Cifras ejecutadas del rango seleccionado: solo los movimientos pagados alimentan la caja."
        acciones={
          <EnlaceBoton href={`/reportes?${consultaDelPanel}`} variant="secondary">
            <FileDown className="size-4" aria-hidden /> Exportar esta vista
          </EnlaceBoton>
        }
      />

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderKanban className="size-7" />}
          titulo="Empieza creando tu primer proyecto"
          descripcion="Un inmueble, un vehículo, un negocio o una inversión. Cada proyecto lleva su propia inversión, gastos, ingresos y rentabilidad."
          accion={
            <EnlaceBoton href="/proyectos/nuevo">
              <Plus className="size-4" aria-hidden /> Crear proyecto
            </EnlaceBoton>
          }
        />
      ) : (
        <>
          {/*
            RF-79: un solo filtro para todo el panel, y pegajoso. Antes había que
            subir hasta arriba para cambiar el rango y volver a bajar a la gráfica
            que se estaba mirando.
          */}
          <div className="sticky top-14 z-20 -mx-4 bg-background/80 px-4 py-2 backdrop-blur-xl md:-mx-8 md:px-8">
            <Suspense fallback={<Skeleton className="h-20 w-full" />}>
              <FiltrosPanel
                proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
                desde={filtro.desde ?? hoy}
                hasta={filtro.hasta ?? hoy}
              />
            </Suspense>
          </div>

          {/* RF-70, con la variación que responde «¿qué cambió?». */}
          <section aria-label="Indicadores globales">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TarjetaIndicador
                etiqueta="Balance general"
                valor={formatearDineroCompacto(totales.balance, moneda)}
                tono={totales.balance >= 0 ? "positivo" : "negativo"}
                variacion={variacion.balance}
                detalle={detalleVariacion(variacion.periodoAnterior, "Ingresos − egresos")}
                icono={<Scale className="size-4" />}
              />
              <TarjetaIndicador
                etiqueta="Total de ingresos"
                valor={formatearDineroCompacto(totales.totalIngresos, moneda)}
                tono="positivo"
                variacion={variacion.totalIngresos}
                detalle="Dinero recibido"
                icono={<Banknote className="size-4" />}
              />
              <TarjetaIndicador
                etiqueta="Total de egresos"
                valor={formatearDineroCompacto(totales.totalEgresos, moneda)}
                variacion={variacion.totalEgresos}
                // Que los egresos suban no es una buena noticia: la flecha va al revés.
                subirEsBueno={false}
                detalle="Inversión + gastos + cuotas"
                icono={<Receipt className="size-4" />}
              />
              <TarjetaIndicador
                etiqueta="Total invertido"
                valor={formatearDineroCompacto(totales.totalInvertido, moneda)}
                variacion={variacion.totalInvertido}
                detalle="Egresos que capitalizan"
                icono={<Landmark className="size-4" />}
              />
            </div>
          </section>

          {/*
            RF-71 y RF-73: lo que pasa y lo que urge, en la misma pantalla.

            Los dos paneles comparten fila, así que miden lo que el más alto. Con
            diez vencimientos la agenda llegaba a ~700 px y estiraba al panel del
            flujo, que dibujaba su trazo de 240 px arriba y dejaba el resto en
            blanco: el hueco no era de la gráfica, era de la fila. Se corrige por
            los dos lados —la agenda se acota a los cinco más urgentes con el resto
            a un clic, y el trazo pasa a `flexible` para absorber la diferencia que
            quede—, porque arreglar solo uno deja el mismo hueco en el caso
            contrario: dos vencimientos y una gráfica más alta que ellos.
          */}
          <div className="grid gap-4 xl:grid-cols-3">
            <PanelGrafica
              className="xl:col-span-2"
              titulo="Flujo de caja ejecutado"
              descripcion={`Ingresos y egresos pagados, mes a mes. Acumulado del rango: ${formatearDineroCompacto(acumuladoFinal, moneda)}.`}
              leyenda={[
                { etiqueta: "Ingresos", serie: 1 },
                { etiqueta: "Egresos", serie: 2 },
              ]}
            >
              {panel.flujoMensual.length === 0 ? (
                <EstadoVacio
                  denso
                  className="flex-1"
                  titulo="Sin movimientos pagados en el rango"
                  descripcion="Amplía el rango o registra movimientos."
                />
              ) : (
                <GraficoFlujo flexible puntos={panel.flujoMensual} moneda={moneda} />
              )}
            </PanelGrafica>

            <PanelAgenda
              eventos={agenda}
              metodosPago={metodosPago}
              hoy={hoy}
              formatoFecha={ajustes.formatoFecha}
              moneda={ajustes.moneda}
              titulo="Requiere atención"
              maximo={AGENDA_EN_PANEL}
              verTodo={{ href: "/obligaciones", etiqueta: "Obligaciones" }}
              vacio={{
                titulo: "Nada pendiente",
                descripcion: "Sin obligaciones vencidas ni vencimientos en los próximos 30 días.",
              }}
            />
          </div>

          {/* RF-76 y RF-72 */}
          <div className="grid gap-4 xl:grid-cols-2">
            <PanelGrafica
              titulo="Gasto por categoría"
              descripcion="Distribución de los egresos del rango, agrupados por categoría raíz."
            >
              {filasGasto.length === 0 ? (
                <EstadoVacio
                  denso
                  titulo="Sin gastos en el rango"
                  descripcion="Cuando registres egresos verás aquí en qué se va el dinero."
                />
              ) : (
                <BarrasRanking filas={filasGasto} moneda={moneda} serie={2} />
              )}
            </PanelGrafica>

            <PanelGrafica
              titulo="Flujo proyectado"
              descripcion="Obligaciones y movimientos comprometidos que aún no se han ejecutado. Siempre a doce meses vista, no al rango consultado."
              leyenda={[
                { etiqueta: "Esperado", serie: 1 },
                { etiqueta: "Estimado", serie: 2 },
              ]}
            >
              {/*
                `flexible` también aquí: el ranking de la izquierda mide lo que le
                dicten sus categorías —hasta nueve barras—, y esta gráfica es la
                que tiene que dar de sí para que la fila no repita el hueco.
              */}
              {panel.flujoProyectado.length === 0 ? (
                <EstadoVacio
                  denso
                  className="flex-1"
                  titulo="Sin compromisos futuros"
                  descripcion="Registra obligaciones para ver la proyección de los próximos meses."
                />
              ) : (
                <GraficoFlujo flexible puntos={panel.flujoProyectado} moneda={moneda} />
              )}
            </PanelGrafica>
          </div>

          {/* RF-74 + RF-77 fusionados, con el semáforo de §5.5. */}
          <section className="space-y-3">
            <CabeceraSeccion
              titulo="Cartera"
              // El semáforo de cada proyecto ya se leía fila a fila, pero con diez
              // proyectos «¿alguno necesita atención?» exigía recorrer la columna
              // entera. El recuento sale del mismo mapa que pinta las insignias:
              // ningún dato nuevo y ninguna consulta más.
              descripcion={`${panel.proyectosActivos} de ${proyectos.length} activos · ${textoSemaforos(semaforos)}. El ROI aparece como «—» cuando no hay inversión sobre la que calcularlo.`}
              acciones={
                <EnlaceBoton href="/proyectos" variant="ghost" size="sm">
                  Gestionar proyectos
                </EnlaceBoton>
              }
            />

            <TablaCartera
              proyectos={proyectos}
              semaforos={semaforos}
              roiPorProyecto={panel.roiPorProyecto}
              formatoFecha={ajustes.formatoFecha}
            />
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Resume el semáforo de §5.5 de toda la cartera en una línea.
 *
 * Se nombra solo lo que requiere acción: «8 saludables» es la ausencia de noticia
 * y ocupa el mismo espacio que la noticia.
 */
function textoSemaforos(semaforos: Map<string, { estado: string }>): string {
  let riesgo = 0;
  let observacion = 0;

  for (const { estado } of semaforos.values()) {
    if (estado === "riesgo") riesgo += 1;
    else if (estado === "observacion") observacion += 1;
  }

  const partes = [
    riesgo > 0 ? `${riesgo} en riesgo` : null,
    observacion > 0 ? `${observacion} en observación` : null,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" y ") : "ninguno en riesgo";
}

/** Dice contra qué se compara, para que la flecha no sea un dato huérfano. */
function detalleVariacion(
  periodo: { desde: string; hasta: string } | null,
  porOmision: string,
): string {
  if (!periodo) return porOmision;
  return `vs. ${formatearMes(periodo.desde)} – ${formatearMes(periodo.hasta)}`;
}
