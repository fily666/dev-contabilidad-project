import {
  Banknote,
  Calendar,
  Coins,
  Landmark,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto, formatearPorcentaje } from "@/shared/utils/formato";
import type { Indicadores } from "../../domain/indicadores";

type Definicion = {
  etiqueta: string;
  valor: (i: Indicadores) => string;
  detalle?: string;
  tono?: (i: Indicadores) => "neutro" | "positivo" | "negativo" | "advertencia";
  icono: React.ReactNode;
  /** Indicador anualizado: se marca como estimado si hay menos de 12 meses (§5.3). */
  anualizado?: boolean;
};

const signo = (v: number): "positivo" | "negativo" => (v >= 0 ? "positivo" : "negativo");

/**
 * Catalogo de indicadores. La visibilidad la decide el tipo de proyecto
 * mediante `configuracion.indicadores` (Contexto.md §5.4), no condicionales
 * dispersos en la interfaz.
 */
const CATALOGO: Record<string, Definicion> = {
  total_invertido: {
    etiqueta: "Total invertido",
    valor: (i) => formatearDineroCompacto(i.totalInvertido, i.moneda),
    detalle: "Egresos que capitalizan",
    icono: <Landmark className="size-4" />,
  },
  total_ingresos: {
    etiqueta: "Total de ingresos",
    valor: (i) => formatearDineroCompacto(i.totalIngresos, i.moneda),
    detalle: "Dinero recibido",
    icono: <Banknote className="size-4" />,
  },
  total_egresos: {
    etiqueta: "Total de egresos",
    valor: (i) => formatearDineroCompacto(i.totalEgresos, i.moneda),
    detalle: "Inversión + gastos + cuotas",
    icono: <Receipt className="size-4" />,
  },
  balance: {
    etiqueta: "Balance",
    valor: (i) => formatearDineroCompacto(i.balance, i.moneda),
    detalle: "Ingresos − egresos",
    tono: (i) => signo(i.balance),
    icono: <Scale className="size-4" />,
  },
  capital_aportado: {
    etiqueta: "Capital aportado",
    valor: (i) => formatearDineroCompacto(i.capitalAportado, i.moneda),
    detalle: "Dinero propio puesto",
    icono: <Wallet className="size-4" />,
  },
  noi: {
    etiqueta: "NOI anual",
    valor: (i) => formatearDineroCompacto(i.noiAnual, i.moneda),
    detalle: "Ingresos − gastos operativos (12 m)",
    tono: (i) => signo(i.noiAnual),
    icono: <Coins className="size-4" />,
    anualizado: true,
  },
  yield_bruto: {
    etiqueta: "Yield bruto",
    valor: (i) => formatearPorcentaje(i.yieldBruto),
    detalle: "Ingresos 12 m / invertido",
    icono: <Percent className="size-4" />,
    anualizado: true,
  },
  yield_neto: {
    etiqueta: "Yield neto",
    valor: (i) => formatearPorcentaje(i.yieldNeto),
    detalle: "NOI / invertido",
    icono: <Percent className="size-4" />,
    anualizado: true,
  },
  cap_rate: {
    etiqueta: "Cap rate",
    valor: (i) => formatearPorcentaje(i.capRate),
    detalle: "NOI / valoración actual",
    icono: <Percent className="size-4" />,
    anualizado: true,
  },
  roi_acumulado: {
    etiqueta: "ROI acumulado",
    valor: (i) => formatearPorcentaje(i.roiAcumulado),
    detalle: "Resultado / invertido",
    tono: (i) => (i.roiAcumulado === null ? "neutro" : signo(i.roiAcumulado)),
    icono: <TrendingUp className="size-4" />,
  },
  plusvalia: {
    etiqueta: "Plusvalía",
    valor: (i) => (i.plusvalia === null ? "—" : formatearDineroCompacto(i.plusvalia, i.moneda)),
    detalle: "Valoración − invertido",
    tono: (i) => (i.plusvalia === null ? "neutro" : signo(i.plusvalia)),
    icono: <TrendingUp className="size-4" />,
  },
  retorno_total: {
    etiqueta: "Retorno total",
    valor: (i) => formatearPorcentaje(i.retornoTotal),
    detalle: "Resultado + plusvalía / invertido",
    icono: <TrendingUp className="size-4" />,
  },
  payback: {
    etiqueta: "Payback",
    valor: (i) =>
      i.paybackMeses === null ? "—" : `${i.paybackMeses} ${i.paybackMeses === 1 ? "mes" : "meses"}`,
    detalle: "Meses hasta recuperar la inversión",
    icono: <Calendar className="size-4" />,
  },
  tco: {
    etiqueta: "Costo total (TCO)",
    valor: (i) => formatearDineroCompacto(i.tco, i.moneda),
    detalle: "Todo lo desembolsado",
    icono: <Receipt className="size-4" />,
  },
  costo_mensual: {
    etiqueta: "Costo mensual",
    valor: (i) =>
      i.costoMensual === null ? "—" : formatearDineroCompacto(i.costoMensual, i.moneda),
    detalle: "Promedio desde el inicio",
    icono: <Coins className="size-4" />,
  },
  patrimonio_neto: {
    etiqueta: "Patrimonio neto",
    valor: (i) =>
      i.patrimonioNeto === null ? "—" : formatearDineroCompacto(i.patrimonioNeto, i.moneda),
    detalle: "Valoración − pasivos",
    icono: <PiggyBank className="size-4" />,
  },
};

/**
 * §13, punto 3 del checklist: el registro de indicadores del dominio. Un tipo de
 * proyecto solo puede declarar claves que existan aqui, porque una clave que no
 * este no rompe nada —simplemente no se dibuja— y ese silencio es peor que un
 * error. El gestor de tipos (RF-100) ofrece exactamente esta lista.
 */
export const INDICADORES_DISPONIBLES: Array<{ clave: string; etiqueta: string }> = Object.entries(
  CATALOGO,
).map(([clave, definicion]) => ({ clave, etiqueta: definicion.etiqueta }));

type Props = {
  indicadores: Indicadores;
  /** Claves declaradas por el tipo de proyecto. */
  visibles: string[];
};

export function PanelIndicadores({ indicadores, visibles }: Props) {
  const definiciones = visibles
    .map((clave) => ({ clave, definicion: CATALOGO[clave] }))
    .filter((d): d is { clave: string; definicion: Definicion } => !!d.definicion);

  if (definiciones.length === 0) return null;

  return (
    <section aria-label="Indicadores del proyecto" className="space-y-3">
      <h2 className="etiqueta-dato">Indicadores</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {definiciones.map(({ clave, definicion }) => (
          <TarjetaIndicador
            key={clave}
            etiqueta={definicion.etiqueta}
            valor={definicion.valor(indicadores)}
            detalle={definicion.detalle}
            tono={definicion.tono?.(indicadores) ?? "neutro"}
            icono={definicion.icono}
            estimado={definicion.anualizado && indicadores.esEstimado}
          />
        ))}
      </div>
      {indicadores.esEstimado ? (
        <p className="mt-3 text-xs text-muted-foreground">
          El proyecto tiene {indicadores.mesesDeHistoria}{" "}
          {indicadores.mesesDeHistoria === 1 ? "mes" : "meses"} de historia: los indicadores
          anualizados son estimados.
        </p>
      ) : null}
    </section>
  );
}
