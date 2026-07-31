import type { FlujoMensual } from "@/modules/proyectos/domain/indicadores";
import type {
  DashboardRepository,
  FiltroPanel,
  GastoPorCategoria,
  TotalesGlobales,
} from "../domain/dashboard.repository";

/**
 * Doble en memoria del puerto DashboardRepository (Contexto.md §8.8).
 *
 * Las cifras se declaran ya agregadas, igual que las devuelven las vistas de
 * §6.4: lo que se prueba del panel es la composicion, no la agregacion, que es
 * responsabilidad de SQL y la verifican las pruebas de esquema.
 */
export class DashboardRepositoryEnMemoria implements DashboardRepository {
  totales: TotalesGlobales = {
    totalInvertido: 0,
    totalGastosOperativos: 0,
    totalFinanciacion: 0,
    totalIngresos: 0,
    totalEgresos: 0,
    balance: 0,
    moneda: "COP",
  };
  flujo: FlujoMensual[] = [];
  proyectado: FlujoMensual[] = [];
  gastos: GastoPorCategoria[] = [];
  /** Filtros con los que se llamo, para comprobar que el panel los propaga. */
  filtrosRecibidos: FiltroPanel[] = [];

  async totalesGlobales(filtro: FiltroPanel = {}): Promise<TotalesGlobales> {
    this.filtrosRecibidos.push(filtro);
    return this.totales;
  }

  async flujoMensual(filtro: FiltroPanel = {}): Promise<FlujoMensual[]> {
    this.filtrosRecibidos.push(filtro);
    return this.flujo;
  }

  async flujoProyectado(filtro: FiltroPanel = {}): Promise<FlujoMensual[]> {
    this.filtrosRecibidos.push(filtro);
    return this.proyectado;
  }

  async gastosPorCategoria(filtro: FiltroPanel = {}): Promise<GastoPorCategoria[]> {
    this.filtrosRecibidos.push(filtro);
    return this.gastos;
  }
}
