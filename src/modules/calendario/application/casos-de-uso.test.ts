import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";
import {
  CategoriaRepositoryEnMemoria,
  categoriaDePrueba,
} from "@/modules/categorias/application/dobles";
import {
  ID_TRANSFERENCIA,
  MetodoPagoRepositoryEnMemoria,
  metodoTransferencia,
} from "@/modules/metodos-pago/application/dobles";
import {
  ProyectoRepositoryEnMemoria,
  proyectoDePrueba,
} from "@/modules/proyectos/application/dobles";
import { MovimientoRepositoryEnMemoria } from "@/modules/movimientos/application/dobles";
import { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";
import { RegistrarMovimiento } from "@/modules/movimientos/application/registrar-movimiento.use-case";
import { ObligacionRepositoryEnMemoria } from "@/modules/obligaciones/application/dobles";
import { Obligacion } from "@/modules/obligaciones/domain/obligacion.entity";

import { ObtenerCalendario } from "./obtener-calendario.use-case";

/** Contexto.md §8.8: composicion del calendario (RF-60 a RF-63). */

const OPEX = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const INGRESO = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const HOY = "2026-07-30";

function montar() {
  const proyecto = proyectoDePrueba();
  const proyectos = new ProyectoRepositoryEnMemoria();
  proyectos.filas.set(proyecto.id, proyecto);

  const categorias = new CategoriaRepositoryEnMemoria([
    categoriaDePrueba({ id: OPEX, nombre: "Administración", naturaleza: "opex" }),
    categoriaDePrueba({ id: INGRESO, nombre: "Canon", naturaleza: "ingreso" }),
  ]);

  const movimientos = new MovimientoRepositoryEnMemoria();
  const obligaciones = new ObligacionRepositoryEnMemoria();
  obligaciones.hoy = HOY;
  const reloj = new RelojFijo(HOY);
  let contador = 0;
  const nuevoId = () => `dddddddd-dddd-4ddd-8ddd-dddddddddd${String(++contador).padStart(2, "0")}`;

  const listar = new ListarMovimientos(movimientos, reloj);

  return {
    proyecto,
    obligaciones,
    metodosPago: new MetodoPagoRepositoryEnMemoria([metodoTransferencia()]),
    registrar: new RegistrarMovimiento(movimientos, proyectos, categorias, reloj, nuevoId),
    calendario: new ObtenerCalendario(listar, obligaciones, reloj),
  };
}

describe("ObtenerCalendario", () => {
  it("por omision muestra el mes de hoy", async () => {
    const { calendario } = montar();

    const resultado = await calendario.ejecutar({});

    expect(resultado.mes).toBe("2026-07");
    expect(resultado.dias.some((d) => d.esHoy)).toBe(true);
  });

  it("un movimiento con vencimiento se ubica en esa fecha, no en la de registro", async () => {
    const { calendario, registrar, proyecto } = montar();
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      fecha: "2026-07-01",
      fechaVencimiento: "2026-07-20",
      valor: 300_000,
      descripcion: "Administración julio",
    });

    const resultado = await calendario.ejecutar({});

    expect(
      resultado.dias.find((d) => d.fecha === "2026-07-20")?.eventos.map((e) => e.concepto),
    ).toEqual(["Administración julio"]);
    expect(resultado.dias.find((d) => d.fecha === "2026-07-01")?.eventos).toHaveLength(0);
  });

  it("un pendiente con vencimiento pasado ya aparece como vencido (RF-25)", async () => {
    const { calendario, registrar, proyecto } = montar();
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      fecha: "2026-07-01",
      fechaVencimiento: "2026-07-10",
      valor: 300_000,
      descripcion: "Vencida sin pagar",
    });

    const resultado = await calendario.ejecutar({});
    const evento = resultado.dias
      .flatMap((d) => d.eventos)
      .find((e) => e.concepto === "Vencida sin pagar");

    expect(evento?.estado).toBe("vencido");
  });

  it("suma el comprometido del mes y excluye lo ya pagado (RF-63)", async () => {
    const { calendario, registrar, proyecto } = montar();
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      fecha: "2026-07-15",
      valor: 500_000,
      descripcion: "Pendiente",
    });
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      fecha: "2026-07-16",
      valor: 900_000,
      descripcion: "Ya pagado",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });

    const resultado = await calendario.ejecutar({});

    expect(resultado.comprometido).toBe(500_000);
    expect(resultado.totalEventos).toBe(2);
  });

  it("incluye las ocurrencias de obligaciones del mes", async () => {
    const { calendario, obligaciones, proyecto } = montar();
    await obligaciones.guardar(
      Obligacion.crear({
        id: "0b000000-0000-4000-8000-000000000001",
        proyectoId: proyecto.id,
        categoriaId: OPEX,
        concepto: "Cuota del crédito",
        valorEstimado: 1_500_000,
        fechaVencimiento: "2026-07-10",
        frecuencia: "mensual",
      }),
    );
    await obligaciones.generarOcurrencias(2);

    const resultado = await calendario.ejecutar({});
    const dia = resultado.dias.find((d) => d.fecha === "2026-07-10");

    expect(dia?.eventos.map((e) => e.clase)).toEqual(["ocurrencia"]);
    expect(dia?.comprometido).toBe(1_500_000);
  });

  it("el filtro de ingresos deja fuera las ocurrencias, que siempre son egresos (RF-62)", async () => {
    const { calendario, obligaciones, registrar, proyecto } = montar();
    await obligaciones.guardar(
      Obligacion.crear({
        id: "0b000000-0000-4000-8000-000000000002",
        proyectoId: proyecto.id,
        categoriaId: OPEX,
        concepto: "Cuota",
        valorEstimado: 100_000,
        fechaVencimiento: "2026-07-10",
        frecuencia: "unica",
      }),
    );
    await obligaciones.generarOcurrencias(1);
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: INGRESO,
      tipo: "ingreso",
      fecha: "2026-07-05",
      valor: 2_000_000,
      descripcion: "Canon julio",
    });

    const resultado = await calendario.ejecutar({ filtro: { tipo: "ingreso" } });

    expect(resultado.totalEventos).toBe(1);
    expect(resultado.dias.flatMap((d) => d.eventos)[0]?.concepto).toBe("Canon julio");
  });

  it("un mes distinto del actual no marca ningun dia como hoy", async () => {
    const { calendario } = montar();

    const resultado = await calendario.ejecutar({ filtro: { mes: "2026-03" } });

    expect(resultado.mes).toBe("2026-03");
    expect(resultado.dias.some((d) => d.esHoy)).toBe(false);
  });
});
