import type { Metadata } from "next";
import { BellRing } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina, CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearInstante } from "@/shared/utils/formato";
import {
  CANALES_NOTIFICACION,
  type CanalNotificacion,
} from "@/modules/notificaciones/domain/notificacion.entity";
import { SelectorCanal } from "@/modules/notificaciones/presentation/components/selector-canal";
import {
  TablaAvisos,
  type AvisoEnTabla,
} from "@/modules/notificaciones/presentation/components/tabla-avisos";

export const metadata: Metadata = { title: "Avisos" };

/** Tope del historial: es una bitácora, no un módulo con paginación propia. */
const LIMITE = 100;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function leerCanal(valor: string | string[] | undefined): CanalNotificacion | "todos" {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return CANALES_NOTIFICACION.find((canal) => canal === texto) ?? "todos";
}

/**
 * Historial de avisos (RF-59, §10.2).
 *
 * La pantalla que faltaba: `notificaciones` se escribía desde la Fase 4 y nada la
 * leía, que era el último hueco abierto de §17. Responde dos preguntas distintas
 * de las que responde la campana —¿salió el correo?, ¿se está reintentando?—, y
 * por eso usa `listar` y no `bandeja`.
 */
export default async function PaginaAvisos({ searchParams }: Props) {
  const parametros = await searchParams;
  const { contenedor, ajustes } = await contenedorPrivado();

  const canal = leerCanal(parametros.canal);

  const [avisos, bandeja] = await Promise.all([
    contenedor.notificaciones.listar.ejecutar({
      limite: LIMITE,
      canal: canal === "todos" ? undefined : canal,
    }),
    // El contador es el de la campana, no el de esta lista: la lista puede venir
    // filtrada por canal y aun así «3 sin leer» debe seguir siendo cierto.
    contenedor.notificaciones.bandeja.ejecutar({ limite: 1 }),
  ]);

  const enviados = avisos.filter((aviso) => aviso.estado === "enviada").length;
  const enCola = avisos.filter(
    (aviso) => aviso.estado === "programada" || aviso.estado === "fallida",
  ).length;

  const filas: AvisoEnTabla[] = avisos.map((aviso) => ({
    id: aviso.id,
    canal: aviso.canal,
    asunto: aviso.asunto,
    // El correo guarda HTML en `cuerpo` (§10.3): sin limpiarlo, la tabla mostraría
    // etiquetas crudas. La versión in-app ya es texto plano.
    cuerpo: aviso.cuerpo
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    estado: aviso.estado,
    intentos: aviso.intentos,
    error: aviso.error,
    programadaPara: formatearInstante(aviso.programadaPara, ajustes.zonaHoraria),
    enviadaEn: aviso.enviadaEn ? formatearInstante(aviso.enviadaEn, ajustes.zonaHoraria) : null,
    leido: aviso.canal === "in_app" ? aviso.leidaEn !== null : null,
  }));

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Notificaciones"
        titulo="Avisos"
        descripcion="Lo que el sistema programó y envió por cada canal. Los avisos in-app son los que aparecen en la campana de la barra superior."
      />

      {/*
        Tres tarjetas en tres columnas desde `sm`. Estaban en `sm:grid-cols-2
        xl:grid-cols-3`, así que entre 640 y 1280 px —la franja donde cabe casi
        cualquier portátil— la tercera se quedaba sola en su fila con media
        pantalla vacía al lado.
      */}
      <div className="grid gap-3 sm:grid-cols-3">
        <TarjetaIndicador
          etiqueta="Sin leer en la campana"
          valor={String(bandeja.noLeidos)}
          detalle={bandeja.noLeidos > 0 ? "Avisos in-app pendientes de ver" : "Todo visto"}
          tono={bandeja.noLeidos > 0 ? "advertencia" : "positivo"}
        />
        <TarjetaIndicador
          etiqueta="Enviados"
          valor={String(enviados)}
          detalle="En este historial"
        />
        <TarjetaIndicador
          etiqueta="En cola o reintentando"
          valor={String(enCola)}
          // La referencia «(§10.1)» remitía al documento de especificación desde la
          // interfaz: el usuario no tiene ese documento delante.
          detalle="Se envían solos, revisión cada hora"
          tono={enCola > 0 ? "advertencia" : "neutro"}
        />
      </div>

      <CabeceraSeccion
        titulo={`Historial · últimos ${LIMITE}`}
        acciones={<SelectorCanal canal={canal} />}
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={<BellRing className="size-8" />}
          titulo="Todavía no hay avisos"
          descripcion="Las obligaciones activas generan sus avisos según los días de anticipación configurados en los ajustes."
        />
      ) : (
        <TablaAvisos avisos={filas} noLeidos={bandeja.noLeidos} />
      )}
    </div>
  );
}
