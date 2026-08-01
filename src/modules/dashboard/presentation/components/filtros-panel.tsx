"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

const TODOS = "__todos__";

type Props = {
  proyectos: Array<{ id: string; nombre: string }>;
  /** Rango vigente, ya resuelto por el servidor. */
  desde: string;
  hasta: string;
};

/** Atajos de rango: lo que se consulta el 95 % de las veces. */
const ATAJOS = [
  { etiqueta: "12 meses", meses: 12 },
  { etiqueta: "6 meses", meses: 6 },
  { etiqueta: "3 meses", meses: 3 },
] as const;

/**
 * El rango del panel es MENSUAL, no diario, y los campos lo dicen.
 *
 * Las vistas de §6.4 agregan por mes (`date_trunc('month', fecha)`), así que el
 * adaptador lleva cualquier fecha al día 1 antes de consultar. Mientras los
 * campos fueron `type="date"`, elegir «15 de marzo → 10 de abril» devolvía marzo
 * y abril completos: la interfaz prometía una precisión que la consulta no tiene
 * y no había forma de que el usuario se enterara. Un selector de mes no puede
 * mentir sobre eso.
 *
 * Lo que viaja en la URL sigue siendo una fecha completa, por dos razones: no
 * rompe los enlaces ya compartidos (RNF-09) y deja el valor listo para quien lo
 * lea como día —los reportes, por ejemplo—. De ahí que `hasta` se escriba con el
 * ÚLTIMO día del mes y no con el primero: así el rango es correcto tanto si se
 * interpreta por mes como si se interpreta por día.
 */
const mesDe = (fechaIso: string): string => fechaIso.slice(0, 7);

const primerDia = (mes: string): string => `${mes}-01`;

function ultimoDia(mes: string): string {
  const [anio, m] = mes.split("-").map(Number) as [number, number];
  // Día 0 del mes siguiente es el último del mes pedido.
  return new Date(Date.UTC(anio, m, 0)).toISOString().slice(0, 10);
}

/** Rango de los últimos N meses contando el mes de `hasta` como uno de ellos. */
function rangoDeMeses(mesHasta: string, meses: number): { desde: string; hasta: string } {
  const [anio, m] = mesHasta.split("-").map(Number) as [number, number];
  const inicio = new Date(Date.UTC(anio, m - meses, 1));
  return { desde: inicio.toISOString().slice(0, 10), hasta: ultimoDia(mesHasta) };
}

/** RF-79: un solo filtro para todas las cifras del panel. */
export function FiltrosPanel({ proyectos, desde, hasta }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();

  function aplicar(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "" || valor === TODOS) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    router.push(`?${nuevos.toString()}`);
  }

  const hayFiltros = [...parametros.keys()].length > 0;

  return (
    <div className="panel flex flex-wrap items-end gap-3 p-5">
      <div className="min-w-44 space-y-1.5">
        <Label htmlFor="panel-proyecto" className="text-xs">
          Proyecto
        </Label>
        <Select
          value={parametros.get("proyectoId") ?? TODOS}
          onValueChange={(v) => aplicar({ proyectoId: v })}
        >
          <SelectTrigger id="panel-proyecto" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="panel-desde" className="text-xs">
          Desde
        </Label>
        <Input
          id="panel-desde"
          type="month"
          value={mesDe(desde)}
          onChange={(e) =>
            e.target.value ? aplicar({ desde: primerDia(e.target.value) }) : undefined
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="panel-hasta" className="text-xs">
          Hasta
        </Label>
        <Input
          id="panel-hasta"
          type="month"
          value={mesDe(hasta)}
          onChange={(e) =>
            e.target.value ? aplicar({ hasta: ultimoDia(e.target.value) }) : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
        {ATAJOS.map((atajo) => (
          <Button
            key={atajo.etiqueta}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => aplicar(rangoDeMeses(mesDe(hasta), atajo.meses))}
          >
            {atajo.etiqueta}
          </Button>
        ))}
        {hayFiltros ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("?")}>
            <X className="size-4" aria-hidden /> Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
