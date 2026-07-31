import type { EstadoOcurrencia } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import { diasEntre } from "@/shared/domain/reloj";
import type { Obligacion } from "../domain/obligacion.entity";
import type {
  EventoAgenda,
  FiltroAgenda,
  FiltroObligaciones,
  ObligacionListada,
  ObligacionRepository,
  OcurrenciaListada,
} from "../domain/obligacion.repository";
import { Ocurrencia } from "../domain/ocurrencia.entity";
import { limiteDelHorizonte } from "../domain/recurrencia";

/**
 * Doble en memoria del puerto ObligacionRepository (Contexto.md §8.8).
 *
 * `generarOcurrencias` reproduce en TypeScript lo que en produccion hace la
 * funcion SQL: usa las mismas fechas del dominio y el mismo criterio de
 * idempotencia (una ocurrencia por obligacion y fecha), que es lo que las
 * pruebas de los casos de uso necesitan comprobar.
 */
export class ObligacionRepositoryEnMemoria implements ObligacionRepository {
  readonly filas = new Map<string, Obligacion>();
  readonly ocurrencias = new Map<string, Ocurrencia>();
  eliminados: string[] = [];
  /** Fecha de negocio con la que se calculan `dias_restantes` y los vencidos. */
  hoy: FechaIso = "2026-07-30";
  private contador = 0;

  async buscarPorId(id: string): Promise<Obligacion | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(filtro: FiltroObligaciones = {}): Promise<ObligacionListada[]> {
    return [...this.filas.values()]
      .filter((o) => !filtro.proyectoId || o.proyectoId === filtro.proyectoId)
      .filter((o) => !filtro.soloActivas || o.activa)
      .filter((o) => !filtro.texto || o.concepto.toLowerCase().includes(filtro.texto.toLowerCase()))
      .map((o) => {
        const suyas = [...this.ocurrencias.values()].filter((oc) => oc.obligacionId === o.id);
        const abiertas = suyas
          .filter((oc) => oc.estado === "pendiente" || oc.estado === "vencida")
          .map((oc) => oc.fechaVencimiento)
          .sort();

        return {
          id: o.id,
          proyectoId: o.proyectoId,
          proyectoNombre: "Proyecto",
          tipoProyectoId: "tipo",
          categoriaId: o.categoriaId,
          categoria: "Categoría",
          concepto: o.concepto,
          valorEstimado: o.valorEstimado,
          moneda: "COP",
          fechaVencimiento: o.fechaVencimiento,
          frecuencia: o.frecuencia,
          intervaloMeses: o.intervaloMeses,
          diasAviso: o.diasAviso,
          activa: o.activa,
          proximoVencimiento: abiertas[0] ?? null,
          ocurrenciasPendientes: suyas.filter((oc) => oc.estado === "pendiente").length,
          ocurrenciasVencidas: suyas.filter((oc) => oc.estado === "vencida").length,
        };
      });
  }

  async guardar(obligacion: Obligacion): Promise<Obligacion> {
    this.filas.set(obligacion.id, obligacion);
    return obligacion;
  }

  async actualizar(obligacion: Obligacion): Promise<Obligacion> {
    this.filas.set(obligacion.id, obligacion);
    return obligacion;
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    for (const [clave, ocurrencia] of this.ocurrencias) {
      if (ocurrencia.obligacionId === id) this.ocurrencias.delete(clave);
    }
    this.eliminados.push(id);
  }

  async contarOcurrenciasPagadas(obligacionId: string): Promise<number> {
    return [...this.ocurrencias.values()].filter(
      (oc) => oc.obligacionId === obligacionId && oc.estado === "pagada",
    ).length;
  }

  async buscarOcurrencia(id: string): Promise<Ocurrencia | null> {
    return this.ocurrencias.get(id) ?? null;
  }

  async actualizarOcurrencia(ocurrencia: Ocurrencia): Promise<Ocurrencia> {
    this.ocurrencias.set(ocurrencia.id, ocurrencia);
    return ocurrencia;
  }

  async listarOcurrencias(obligacionId: string): Promise<OcurrenciaListada[]> {
    return [...this.ocurrencias.values()]
      .filter((oc) => oc.obligacionId === obligacionId)
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
      .map((oc) => ({
        id: oc.id,
        fechaVencimiento: oc.fechaVencimiento,
        valorEstimado: oc.valorEstimado,
        estado: oc.estado,
        movimientoId: oc.movimientoId,
      }));
  }

  async listarAgenda(filtro: FiltroAgenda = {}): Promise<EventoAgenda[]> {
    const abiertas: EstadoOcurrencia[] = ["pendiente", "vencida"];

    return (
      [...this.ocurrencias.values()]
        .filter((oc) => abiertas.includes(oc.estado))
        .map((oc) => {
          const obligacion = this.filas.get(oc.obligacionId);
          return {
            ocurrenciaId: oc.id,
            obligacionId: oc.obligacionId,
            proyectoId: obligacion?.proyectoId ?? "",
            proyectoNombre: "Proyecto",
            concepto: obligacion?.concepto ?? "",
            categoriaId: obligacion?.categoriaId ?? "",
            fechaVencimiento: oc.fechaVencimiento,
            valorEstimado: oc.valorEstimado,
            moneda: "COP",
            estado: oc.estado,
            diasRestantes: diasEntre(this.hoy, oc.fechaVencimiento),
            movimientoId: oc.movimientoId,
          };
        })
        .filter((e) => !filtro.proyectoId || e.proyectoId === filtro.proyectoId)
        .filter((e) => !filtro.estados?.length || filtro.estados.includes(e.estado))
        .filter((e) => !filtro.desde || e.fechaVencimiento >= filtro.desde)
        .filter((e) => !filtro.hasta || e.fechaVencimiento <= filtro.hasta)
        // Misma ventana que el adaptador real: `dentroDeDias` acota por arriba y,
        // sin `incluirVencidas`, la ventana empieza hoy (RF-58).
        .filter((e) => {
          if (filtro.dentroDeDias !== undefined) {
            if (e.diasRestantes > filtro.dentroDeDias) return false;
            if (!filtro.incluirVencidas && e.diasRestantes < 0) return false;
            return true;
          }
          return filtro.incluirVencidas !== false || e.diasRestantes >= 0;
        })
        .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
    );
  }

  async generarOcurrencias(horizonteMeses: number): Promise<number> {
    const limite = limiteDelHorizonte(this.hoy, horizonteMeses);
    let insertadas = 0;

    for (const obligacion of this.filas.values()) {
      for (const fecha of obligacion.vencimientosHasta(limite)) {
        const yaExiste = [...this.ocurrencias.values()].some(
          (oc) => oc.obligacionId === obligacion.id && oc.fechaVencimiento === fecha,
        );
        if (yaExiste) continue;

        this.contador += 1;
        const id = `0c000000-0000-4000-8000-${String(this.contador).padStart(12, "0")}`;
        this.ocurrencias.set(
          id,
          Ocurrencia.desdePersistencia({
            id,
            obligacionId: obligacion.id,
            fechaVencimiento: fecha,
            valorEstimado: obligacion.valorEstimado,
            estado: "pendiente",
            movimientoId: null,
          }),
        );
        insertadas += 1;
      }
    }

    return insertadas;
  }

  async marcarVencidos(): Promise<number> {
    let actualizados = 0;
    for (const [clave, ocurrencia] of this.ocurrencias) {
      const datos = ocurrencia.aDatos();
      if (datos.estado === "pendiente" && datos.fechaVencimiento < this.hoy) {
        this.ocurrencias.set(clave, Ocurrencia.desdePersistencia({ ...datos, estado: "vencida" }));
        actualizados += 1;
      }
    }
    return actualizados;
  }
}
