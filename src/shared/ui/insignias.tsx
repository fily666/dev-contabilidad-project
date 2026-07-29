import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import type { EstadoMovimiento, EstadoProyecto, Naturaleza } from "@/shared/domain/enumeraciones";
import {
  ETIQUETA_ESTADO_MOVIMIENTO,
  ETIQUETA_ESTADO_PROYECTO,
  ETIQUETA_NATURALEZA,
} from "@/shared/utils/etiquetas";
import type { EstadoFinanciero } from "@/modules/proyectos/domain/indicadores";

const CLASES_ESTADO_MOVIMIENTO: Record<EstadoMovimiento, string> = {
  pagado: "bg-success-soft text-success-foreground border-success/30",
  pendiente: "bg-info-soft text-foreground border-info/30",
  vencido: "bg-danger-soft text-destructive border-destructive/30",
  anulado: "bg-muted text-muted-foreground border-border line-through",
};

export function InsigniaEstadoMovimiento({ estado }: { estado: EstadoMovimiento }) {
  return (
    <Badge variant="outline" className={cn("font-medium", CLASES_ESTADO_MOVIMIENTO[estado])}>
      {ETIQUETA_ESTADO_MOVIMIENTO[estado]}
    </Badge>
  );
}

const CLASES_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: "bg-success-soft text-success-foreground border-success/30",
  pausado: "bg-warning-soft text-warning-foreground border-warning/30",
  finalizado: "bg-info-soft text-foreground border-info/30",
  archivado: "bg-muted text-muted-foreground border-border",
};

export function InsigniaEstadoProyecto({ estado }: { estado: EstadoProyecto }) {
  return (
    <Badge variant="outline" className={cn("font-medium", CLASES_ESTADO_PROYECTO[estado])}>
      {ETIQUETA_ESTADO_PROYECTO[estado]}
    </Badge>
  );
}

const CLASES_NATURALEZA: Record<Naturaleza, string> = {
  capex: "bg-info-soft text-foreground border-info/30",
  opex: "bg-muted text-muted-foreground border-border",
  financiacion: "bg-warning-soft text-warning-foreground border-warning/30",
  ingreso: "bg-success-soft text-success-foreground border-success/30",
};

export function InsigniaNaturaleza({ naturaleza }: { naturaleza: Naturaleza }) {
  return (
    <Badge variant="outline" className={cn("font-medium", CLASES_NATURALEZA[naturaleza])}>
      {ETIQUETA_NATURALEZA[naturaleza]}
    </Badge>
  );
}

const CLASES_ESTADO_FINANCIERO: Record<EstadoFinanciero, string> = {
  saludable: "bg-success-soft text-success-foreground border-success/30",
  observacion: "bg-warning-soft text-warning-foreground border-warning/30",
  riesgo: "bg-danger-soft text-destructive border-destructive/30",
};

const ETIQUETA_ESTADO_FINANCIERO: Record<EstadoFinanciero, string> = {
  saludable: "Saludable",
  observacion: "En observación",
  riesgo: "En riesgo",
};

/** §5.5 Semáforo del estado financiero del proyecto. */
export function InsigniaEstadoFinanciero({
  estado,
  motivo,
}: {
  estado: EstadoFinanciero;
  motivo?: string;
}) {
  return (
    <Badge
      variant="outline"
      title={motivo}
      className={cn("font-medium", CLASES_ESTADO_FINANCIERO[estado])}
    >
      {ETIQUETA_ESTADO_FINANCIERO[estado]}
    </Badge>
  );
}
