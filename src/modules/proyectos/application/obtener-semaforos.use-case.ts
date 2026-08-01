import type { Reloj } from "@/shared/domain/reloj";
import type { DashboardRepository } from "@/modules/dashboard/domain/dashboard.repository";
import type { ObligacionRepository } from "@/modules/obligaciones/domain/obligacion.repository";
import type { PresupuestoRepository } from "@/modules/presupuestos/domain/presupuesto.repository";

import {
  calcularEstadoFinanciero,
  type EstadoFinanciero,
  type SenalesEstadoFinanciero,
} from "../domain/indicadores";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

/** Meses de flujo que mira §5.5 para decidir si un proyecto está en riesgo. */
const MESES_DE_FLUJO = 3;

export type Semaforo = { estado: EstadoFinanciero; motivo: string };

/**
 * §5.5: el semáforo de estado financiero de cada proyecto.
 *
 * `calcularEstadoFinanciero` existía —escrita y con siete casos de prueba en
 * verde— desde la fase 1, y **ninguna pantalla la llamaba**. §3 la declara
 * indicador exigido de los dos escenarios de referencia, así que la pregunta «¿qué
 * requiere atención?» se respondía leyendo tres paneles distintos y cruzándolos de
 * memoria. Lo que faltaba no era el cálculo: era alguien que reuniera las señales.
 *
 * Este caso de uso las reúne **para todos los proyectos a la vez**, con tres
 * lecturas agregadas y no con tres por proyecto. Es lo que permite pintar el
 * semáforo en una tabla de veinte filas sin sesenta consultas.
 *
 * Sobre las tres señales, y por qué ninguna se puede dar por supuesta:
 *
 * - **Vencidas y por vencer** salen de la agenda, con la ventana de 7 días que
 *   §5.5 usa para «en observación».
 * - **El flujo de tres meses** se ancla a HOY, no al rango que el panel esté
 *   consultando: un proyecto no está en riesgo por lo que pasó en un periodo que
 *   el usuario eligió mirar.
 * - **El presupuesto** solo cuenta si hay uno vigente. Si no lo hay, la señal es
 *   `null` y no `false`: pasar `presupuestoExcedido: false` cuando no se sabe
 *   habría producido «saludable» por ignorancia, que es exactamente el tipo de
 *   cero engañoso que la guarda de §5.3 prohíbe para los porcentuales.
 * - **`generaIngresos`** viene de la configuración del tipo (§5.4). Sin ella, un
 *   vehículo —que por diseño nunca genera ingresos— saldría «en riesgo» todos los
 *   meses por tener flujo negativo, que es su comportamiento normal.
 */
export class ObtenerSemaforos {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly obligaciones: ObligacionRepository,
    private readonly presupuestos: PresupuestoRepository,
    private readonly tipos: TipoProyectoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(
    proyectos: ReadonlyArray<{ proyectoId: string; tipoProyectoId: string }>,
  ): Promise<Map<string, Semaforo>> {
    if (proyectos.length === 0) return new Map();

    const hoy = this.reloj.hoy();

    const [agenda, flujoReciente, ejecucion, tipos] = await Promise.all([
      this.obligaciones.listarAgenda({ dentroDeDias: 7, incluirVencidas: true }),
      this.dashboard.flujoRecientePorProyecto(this.mesInicial(hoy)),
      this.presupuestos.listarEjecucion({ vigenteEn: hoy }),
      this.tipos.listar(),
    ]);

    const generaIngresos = new Map(
      tipos.map((tipo) => [tipo.id, tipo.configuracion.generaIngresos]),
    );
    const flujoPorProyecto = new Map(flujoReciente.map((f) => [f.proyectoId, f.flujoNeto]));

    return new Map(
      proyectos.map((proyecto) => {
        const suyas = agenda.filter((e) => e.proyectoId === proyecto.proyectoId);
        // Un presupuesto global (`proyectoId === null`) aplica a todos.
        const suPresupuesto = ejecucion.filter(
          (f) => f.proyectoId === proyecto.proyectoId || f.proyectoId === null,
        );

        const senales: SenalesEstadoFinanciero = {
          obligacionesVencidas: suyas.filter((e) => e.diasRestantes < 0).length,
          obligacionesPorVencer7Dias: suyas.filter((e) => e.diasRestantes >= 0).length,
          flujoUltimos3Meses: flujoPorProyecto.get(proyecto.proyectoId) ?? 0,
          generaIngresos: generaIngresos.get(proyecto.tipoProyectoId) ?? true,
          presupuestoExcedido: suPresupuesto.some((f) => (f.ejecucion ?? 0) > 1),
          ejecucionPresupuesto: mayorEjecucion(suPresupuesto),
        };

        return [proyecto.proyectoId, calcularEstadoFinanciero(senales)] as const;
      }),
    );
  }

  /** Primer día del mes que abre la ventana de tres meses cerrada en hoy. */
  private mesInicial(hoy: string): string {
    const [anio, mes] = hoy.split("-").map(Number) as [number, number];
    const inicio = new Date(Date.UTC(anio, mes - MESES_DE_FLUJO, 1));
    return inicio.toISOString().slice(0, 10);
  }
}

/**
 * La ejecución más alta entre los presupuestos vigentes del proyecto, o `null` si
 * no hay ninguno con porcentaje calculable. Se toma el máximo porque §5.5 pregunta
 * si *algo* está cerca de excederse, no cuánto se ejecuta en promedio: un promedio
 * escondería una partida al 130 % detrás de otras tres al 20 %.
 */
function mayorEjecucion(filas: ReadonlyArray<{ ejecucion: number | null }>): number | null {
  const calculables = filas
    .map((f) => f.ejecucion)
    .filter((e): e is number => e !== null && Number.isFinite(e));

  return calculables.length > 0 ? Math.max(...calculables) : null;
}
