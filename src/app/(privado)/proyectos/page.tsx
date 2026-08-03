import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaProyecto } from "@/modules/proyectos/presentation/components/tarjeta-proyecto";
import { roiDeProyecto } from "@/modules/dashboard/domain/rentabilidad";
import { ESTADOS_PROYECTO, type EstadoProyecto } from "@/shared/domain/enumeraciones";
import { ETIQUETA_ESTADO_PROYECTO } from "@/shared/utils/etiquetas";
import { cn } from "@/shared/utils/cn";

export const metadata: Metadata = { title: "Proyectos" };

type Props = { searchParams: Promise<{ estado?: string }> };

/** RF-10, RF-77. */
export default async function PaginaProyectos({ searchParams }: Props) {
  const { estado } = await searchParams;
  const { contenedor, ajustes } = await contenedorPrivado();

  const estadoFiltro = ESTADOS_PROYECTO.includes(estado as EstadoProyecto)
    ? (estado as EstadoProyecto)
    : undefined;

  /*
    Una sola lectura con los cuatro estados, y el filtro se aplica en memoria.

    Antes la consulta llevaba el estado pedido, así que la vista no sabía cuántos
    proyectos había fuera del filtro: las pastillas de estado eran cinco etiquetas
    sin cifra y había que pulsarlas una por una para descubrir que «Archivado»
    estaba vacío. Con la lista completa —que en una instalación de un solo dueño son
    decenas de filas, no miles— cada pastilla lleva su recuento y el usuario elige
    sabiendo lo que va a encontrar. Es además una consulta y no dos.
  */
  const todos = await contenedor.proyectos.listar.ejecutar({
    filtro: { estados: [...ESTADOS_PROYECTO] },
  });

  const conteos = new Map<EstadoProyecto, number>();
  for (const proyecto of todos) {
    conteos.set(proyecto.estado, (conteos.get(proyecto.estado) ?? 0) + 1);
  }

  // Vigentes = todo lo que no está archivado. Es el filtro por omisión.
  const proyectos = estadoFiltro
    ? todos.filter((p) => p.estado === estadoFiltro)
    : todos.filter((p) => p.estado !== "archivado");

  // §5.5: la señal que dice cuál de los proyectos necesita atención. Una sola
  // llamada para toda la lista, no una por tarjeta.
  const semaforos = await contenedor.dashboard.semaforos.ejecutar(
    proyectos.map((p) => ({ proyectoId: p.proyectoId, tipoProyectoId: p.tipoProyectoId })),
  );

  // El ROI de cada proyecto, con «—» donde no es calculable (§5.3).
  const roiPorProyecto = new Map(
    proyectos.map((p) => [
      p.proyectoId,
      roiDeProyecto({
        proyectoId: p.proyectoId,
        nombre: p.nombre,
        estado: p.estado,
        moneda: p.moneda,
        totalInvertido: p.totalInvertido,
        totalIngresos: p.totalIngresos,
        totalEgresos: p.totalEgresos,
        balance: p.balance,
      }),
    ]),
  );

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Cartera"
        titulo="Proyectos"
        descripcion={`${proyectos.length === 1 ? "1 proyecto" : `${proyectos.length} proyectos`} en el filtro actual, de ${todos.length} en total.`}
        acciones={
          <EnlaceBoton href="/proyectos/nuevo">
            <Plus className="size-4" aria-hidden /> Nuevo proyecto
          </EnlaceBoton>
        }
      />

      <nav
        aria-label="Filtrar por estado"
        className="panel flex flex-wrap gap-2 p-2 shadow-none backdrop-blur-none"
      >
        <FiltroEstado
          activo={!estadoFiltro}
          href="/proyectos"
          etiqueta="Vigentes"
          conteo={todos.filter((p) => p.estado !== "archivado").length}
        />
        {ESTADOS_PROYECTO.map((e) => (
          <FiltroEstado
            key={e}
            activo={estadoFiltro === e}
            href={`/proyectos?estado=${e}`}
            etiqueta={ETIQUETA_ESTADO_PROYECTO[e]}
            conteo={conteos.get(e) ?? 0}
          />
        ))}
      </nav>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderKanban className="size-8" />}
          titulo="Aún no tienes proyectos aquí"
          descripcion="Crea tu primer proyecto —un inmueble, un vehículo, un negocio— y empieza a registrar su inversión, sus gastos y sus ingresos."
          accion={
            <EnlaceBoton href="/proyectos/nuevo">
              <Plus className="size-4" aria-hidden /> Crear proyecto
            </EnlaceBoton>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {proyectos.map((proyecto) => (
            <TarjetaProyecto
              key={proyecto.proyectoId}
              proyecto={proyecto}
              semaforo={semaforos.get(proyecto.proyectoId)}
              roi={roiPorProyecto.get(proyecto.proyectoId)}
              formatoFecha={ajustes.formatoFecha}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FiltroEstado({
  activo,
  href,
  etiqueta,
  conteo,
}: {
  activo: boolean;
  href: string;
  etiqueta: string;
  /** Cuántos proyectos hay tras el filtro, para no tener que pulsarlo y ver. */
  conteo: number;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-[0.08em] uppercase transition-colors",
        activo
          ? "border-neon/40 bg-gradient-to-r from-neon/20 to-neon-2/20 text-foreground"
          : conteo === 0
            ? // Un filtro que no lleva a nada se apaga, pero sigue pulsable: la
              // alternativa —esconderlo— hace que la lista de filtros cambie de
              // longitud según los datos y no se pueda memorizar.
              "border-transparent text-muted-foreground/50 hover:bg-accent/50"
            : "border-transparent text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
      )}
    >
      {etiqueta}
      <span className="font-mono text-[0.65rem] tracking-normal tabular-nums opacity-70">
        {conteo}
      </span>
    </Link>
  );
}
