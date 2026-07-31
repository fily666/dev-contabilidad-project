import type { FechaIso } from "@/shared/domain/reloj";
import type { CifrasProyecto } from "../domain/indicadores";
import { Proyecto } from "../domain/proyecto.entity";
import type {
  FiltroProyectos,
  ProyectoRepository,
  ResumenProyecto,
} from "../domain/proyecto.repository";
import { TipoProyecto, type ConfiguracionTipoProyecto } from "../domain/tipo-proyecto.entity";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

/**
 * Dobles en memoria de los puertos de proyectos (Contexto.md §8.8: «casos de uso
 * con repositorios en memoria»). No son adaptadores: no conocen Supabase ni
 * ninguna tecnologia, solo implementan el contrato del puerto.
 */

const CONFIGURACION_INMUEBLE: ConfiguracionTipoProyecto = {
  atributos: [
    { clave: "direccion", etiqueta: "Dirección", tipo: "text", requerido: true },
    { clave: "matricula", etiqueta: "Matrícula inmobiliaria", tipo: "text", requerido: false },
    { clave: "area_m2", etiqueta: "Área (m²)", tipo: "number", requerido: false },
  ],
  indicadores: ["total_invertido", "total_ingresos", "roi_acumulado", "yield_neto"],
  generaIngresos: true,
  seValoriza: true,
};

const CONFIGURACION_VEHICULO: ConfiguracionTipoProyecto = {
  atributos: [
    { clave: "placa", etiqueta: "Placa", tipo: "text", requerido: true },
    { clave: "marca", etiqueta: "Marca", tipo: "text", requerido: false },
    { clave: "cilindraje", etiqueta: "Cilindraje", tipo: "number", requerido: false },
  ],
  indicadores: ["total_invertido", "tco", "costo_mensual"],
  generaIngresos: false,
  seValoriza: true,
};

export const TIPO_INMUEBLE = new TipoProyecto(
  "11111111-1111-4111-8111-111111111111",
  "inmueble",
  "Inmueble",
  "building-2",
  CONFIGURACION_INMUEBLE,
  true,
  true,
);

export const TIPO_VEHICULO = new TipoProyecto(
  "22222222-2222-4222-8222-222222222222",
  "vehiculo",
  "Vehículo",
  "car",
  CONFIGURACION_VEHICULO,
  true,
  true,
);

export class TipoProyectoRepositoryEnMemoria implements TipoProyectoRepository {
  readonly proyectosPorTipo = new Map<string, number>();
  eliminados: string[] = [];

  constructor(private readonly tipos: TipoProyecto[] = [TIPO_INMUEBLE, TIPO_VEHICULO]) {}

  async listar(): Promise<TipoProyecto[]> {
    return this.tipos.filter((t) => t.activo);
  }

  async listarTodos(): Promise<TipoProyecto[]> {
    return [...this.tipos];
  }

  async guardar(tipo: TipoProyecto): Promise<TipoProyecto> {
    this.tipos.push(tipo);
    return tipo;
  }

  async actualizar(tipo: TipoProyecto): Promise<TipoProyecto> {
    const indice = this.tipos.findIndex((t) => t.id === tipo.id);
    if (indice >= 0) this.tipos[indice] = tipo;
    return tipo;
  }

  async eliminar(id: string): Promise<void> {
    const indice = this.tipos.findIndex((t) => t.id === id);
    if (indice >= 0) this.tipos.splice(indice, 1);
    this.eliminados.push(id);
  }

  async contarProyectos(tipoProyectoId: string): Promise<number> {
    return this.proyectosPorTipo.get(tipoProyectoId) ?? 0;
  }

  async buscarPorId(id: string): Promise<TipoProyecto | null> {
    return this.tipos.find((t) => t.id === id) ?? null;
  }

  async buscarPorCodigo(codigo: string): Promise<TipoProyecto | null> {
    return this.tipos.find((t) => t.codigo === codigo) ?? null;
  }
}

export class ProyectoRepositoryEnMemoria implements ProyectoRepository {
  readonly filas = new Map<string, Proyecto>();
  /** Movimientos por proyecto, para las reglas de RF-18. */
  readonly movimientosPorProyecto = new Map<string, number>();
  /** Cifras a devolver por proyecto; si falta, se devuelven ceros. */
  readonly cifras = new Map<string, Partial<CifrasProyecto>>();
  eliminados: string[] = [];

  async buscarPorId(id: string): Promise<Proyecto | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(filtro?: FiltroProyectos): Promise<ResumenProyecto[]> {
    return [...this.filas.values()]
      .filter((p) => !filtro?.estados || filtro.estados.includes(p.estado))
      .filter((p) => !filtro?.tipoProyectoId || p.tipoProyectoId === filtro.tipoProyectoId)
      .filter((p) => !filtro?.texto || p.nombre.toLowerCase().includes(filtro.texto.toLowerCase()))
      .map((p) => ({
        proyectoId: p.id,
        nombre: p.nombre,
        tipoCodigo: p.tipoProyectoId === TIPO_VEHICULO.id ? "vehiculo" : "inmueble",
        tipoNombre: p.tipoProyectoId === TIPO_VEHICULO.id ? "Vehículo" : "Inmueble",
        icono: null,
        estado: p.estado,
        fechaInicio: p.fechaInicio,
        moneda: p.moneda,
        totalInvertido: 0,
        totalIngresos: 0,
        totalEgresos: 0,
        balance: 0,
        ultimoMovimiento: null,
      }));
  }

  async guardar(proyecto: Proyecto): Promise<Proyecto> {
    this.filas.set(proyecto.id, proyecto);
    return proyecto;
  }

  async actualizar(proyecto: Proyecto): Promise<Proyecto> {
    this.filas.set(proyecto.id, proyecto);
    return proyecto;
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    this.eliminados.push(id);
  }

  async contarMovimientos(proyectoId: string): Promise<number> {
    return this.movimientosPorProyecto.get(proyectoId) ?? 0;
  }

  async obtenerCifras(proyectoId: string, hoy: FechaIso): Promise<CifrasProyecto> {
    const proyecto = this.filas.get(proyectoId);
    const parciales = this.cifras.get(proyectoId) ?? {};

    return {
      moneda: proyecto?.moneda ?? "COP",
      fechaInicio: proyecto?.fechaInicio ?? hoy,
      hoy,
      totalInvertido: 0,
      totalGastosOperativos: 0,
      totalFinanciacion: 0,
      totalIngresos: 0,
      abonosACapital: 0,
      ingresos12m: 0,
      gastosOperativos12m: 0,
      valoracionActual: null,
      pasivoTotal: 0,
      flujoMensual: [],
      ...parciales,
    };
  }
}

/** Proyecto ya persistido, para pruebas que no ejercitan la creacion. */
export function proyectoDePrueba(
  parciales: {
    id?: string;
    tipo?: TipoProyecto;
    nombre?: string;
    fechaInicio?: FechaIso;
    moneda?: string;
    estado?: Proyecto["estado"];
    atributos?: Record<string, unknown>;
  } = {},
): Proyecto {
  const tipo = parciales.tipo ?? TIPO_INMUEBLE;
  const proyecto = Proyecto.crear({
    id: parciales.id ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tipo,
    nombre: parciales.nombre ?? "Apartamento de prueba",
    fechaInicio: parciales.fechaInicio ?? "2026-01-15",
    moneda: parciales.moneda ?? "COP",
    atributos: parciales.atributos ?? { direccion: "Calle 1 # 2-3", placa: "ABC12D" },
  });

  if (parciales.estado && parciales.estado !== "activo") {
    proyecto.cambiarEstado(parciales.estado, "2026-07-30");
  }
  return proyecto;
}
