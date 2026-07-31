import type { Pasivo } from "../domain/pasivo.entity";
import type {
  PasivoListado,
  PasivoRepository,
  PatrimonioProyecto,
  ValoracionListada,
  ValoracionRepository,
} from "../domain/patrimonio.repository";
import type { Valoracion } from "../domain/valoracion.entity";

/** Dobles en memoria de los puertos de patrimonio (Contexto.md §8.8). */

export class PasivoRepositoryEnMemoria implements PasivoRepository {
  readonly filas = new Map<string, Pasivo>();
  eliminados: string[] = [];

  async buscarPorId(id: string): Promise<Pasivo | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(
    filtro: { proyectoId?: string; soloActivos?: boolean } = {},
  ): Promise<PasivoListado[]> {
    return [...this.filas.values()]
      .filter((p) => !filtro.proyectoId || p.proyectoId === filtro.proyectoId)
      .filter((p) => !filtro.soloActivos || p.activo)
      .map((p) => {
        const d = p.aDatos();
        return {
          id: d.id,
          proyectoId: d.proyectoId,
          proyectoNombre: "Proyecto",
          nombre: d.nombre,
          tipo: d.tipo,
          montoOriginal: d.montoOriginal,
          saldoActual: d.saldoActual,
          tasaInteresEa: d.tasaInteresEa,
          plazoMeses: d.plazoMeses,
          valorCuota: d.valorCuota,
          fechaDesembolso: d.fechaDesembolso,
          activo: d.activo,
          moneda: "COP",
          amortizado: p.amortizado,
        };
      });
  }

  async guardar(pasivo: Pasivo): Promise<Pasivo> {
    this.filas.set(pasivo.id, pasivo);
    return pasivo;
  }

  async actualizar(pasivo: Pasivo): Promise<Pasivo> {
    this.filas.set(pasivo.id, pasivo);
    return pasivo;
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    this.eliminados.push(id);
  }
}

export class ValoracionRepositoryEnMemoria implements ValoracionRepository {
  readonly filas = new Map<string, Valoracion>();
  /** Filas que devolvería `v_patrimonio_proyecto` combinada con el resumen. */
  patrimonioDeclarado: PatrimonioProyecto[] = [];
  eliminados: string[] = [];

  async buscarPorId(id: string): Promise<Valoracion | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(filtro: { proyectoId?: string } = {}): Promise<ValoracionListada[]> {
    return [...this.filas.values()]
      .filter((v) => !filtro.proyectoId || v.proyectoId === filtro.proyectoId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((v) => {
        const d = v.aDatos();
        return { ...d, moneda: "COP" };
      });
  }

  async guardar(valoracion: Valoracion): Promise<Valoracion> {
    // Igual que el adaptador: dos valoraciones el mismo dia son una correccion.
    for (const [clave, existente] of this.filas) {
      if (
        existente.proyectoId === valoracion.proyectoId &&
        existente.fecha === valoracion.fecha &&
        clave !== valoracion.id
      ) {
        this.filas.delete(clave);
      }
    }
    this.filas.set(valoracion.id, valoracion);
    return valoracion;
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    this.eliminados.push(id);
  }

  async patrimonio(filtro: { proyectoId?: string } = {}): Promise<PatrimonioProyecto[]> {
    return this.patrimonioDeclarado.filter(
      (f) => !filtro.proyectoId || f.proyectoId === filtro.proyectoId,
    );
  }
}
