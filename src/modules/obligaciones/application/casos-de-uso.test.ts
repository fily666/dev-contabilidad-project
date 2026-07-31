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
import { RegistrarMovimiento } from "@/modules/movimientos/application/registrar-movimiento.use-case";

import {
  ActualizarEstadosVencidos,
  ActualizarObligacion,
  CambiarEstadoObligacion,
  CambiarEstadoOcurrencia,
  CrearObligacion,
  EliminarObligacion,
  GenerarOcurrencias,
  ListarAgenda,
  ListarObligaciones,
  ListarOcurrencias,
  PagarOcurrencia,
  PrevisualizarVencimientos,
} from "./casos-de-uso";
import { ObligacionRepositoryEnMemoria } from "./dobles";

/** Contexto.md §8.8: casos de uso de obligaciones (RF-50 a RF-58). */

const OPEX = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const CREDITO = "cccccccc-cccc-4ccc-8ccc-ccccccccccc4";
const HOY = "2026-07-30";

function montar() {
  const proyecto = proyectoDePrueba();
  const proyectos = new ProyectoRepositoryEnMemoria();
  proyectos.filas.set(proyecto.id, proyecto);

  const categorias = new CategoriaRepositoryEnMemoria([
    categoriaDePrueba({ id: OPEX, nombre: "Administración", naturaleza: "opex" }),
    categoriaDePrueba({ id: CREDITO, nombre: "Cuota del crédito", naturaleza: "financiacion" }),
  ]);

  const metodosPago = new MetodoPagoRepositoryEnMemoria([metodoTransferencia()]);
  const movimientos = new MovimientoRepositoryEnMemoria();
  const obligaciones = new ObligacionRepositoryEnMemoria();
  obligaciones.hoy = HOY;

  const reloj = new RelojFijo(HOY);
  let contador = 0;
  const nuevoId = () => `0b000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`;

  const registrarMovimiento = new RegistrarMovimiento(
    movimientos,
    proyectos,
    categorias,
    reloj,
    nuevoId,
  );

  return {
    proyecto,
    proyectos,
    categorias,
    metodosPago,
    movimientos,
    obligaciones,
    reloj,
    crear: new CrearObligacion(obligaciones, proyectos, categorias, nuevoId),
    actualizar: new ActualizarObligacion(obligaciones, categorias),
    cambiarEstado: new CambiarEstadoObligacion(obligaciones),
    eliminar: new EliminarObligacion(obligaciones),
    listar: new ListarObligaciones(obligaciones),
    listarAgenda: new ListarAgenda(obligaciones),
    listarOcurrencias: new ListarOcurrencias(obligaciones),
    generar: new GenerarOcurrencias(obligaciones),
    marcarVencidos: new ActualizarEstadosVencidos(obligaciones),
    pagar: new PagarOcurrencia(obligaciones, categorias, registrarMovimiento, reloj),
    cambiarEstadoOcurrencia: new CambiarEstadoOcurrencia(obligaciones),
    previsualizar: new PrevisualizarVencimientos(reloj),
  };
}

async function conObligacionMensual() {
  const contexto = montar();
  const obligacion = await contexto.crear.ejecutar({
    proyectoId: contexto.proyecto.id,
    categoriaId: OPEX,
    concepto: "Administración del edificio",
    valorEstimado: 450_000,
    fechaVencimiento: "2026-08-05",
    frecuencia: "mensual",
  });
  await contexto.generar.ejecutar({ horizonteMeses: 12 });
  return { ...contexto, obligacion };
}

describe("CrearObligacion (RF-50, RF-51)", () => {
  it("crea la obligacion activa con los dias de aviso por omision", async () => {
    const { crear, proyecto } = montar();

    const obligacion = await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "Administración",
      valorEstimado: 450_000,
      fechaVencimiento: "2026-08-05",
      frecuencia: "mensual",
    });

    expect(obligacion.activa).toBe(true);
    expect(obligacion.diasAviso).toEqual([5, 1]);
    expect(obligacion.esRecurrente).toBe(true);
  });

  it("admite valor estimado cero cuando el importe se conoce al pagar", async () => {
    const { crear, proyecto } = montar();

    const obligacion = await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "Servicios públicos",
      valorEstimado: 0,
      fechaVencimiento: "2026-08-15",
      frecuencia: "mensual",
    });

    expect(obligacion.valorEstimado).toBe(0);
  });

  it("la frecuencia personalizada exige intervalo (RF-51)", async () => {
    const { crear, proyecto } = montar();

    await expect(
      crear.ejecutar({
        proyectoId: proyecto.id,
        categoriaId: OPEX,
        concepto: "Revisión",
        valorEstimado: 100_000,
        fechaVencimiento: "2026-08-05",
        frecuencia: "personalizada",
      }),
    ).rejects.toMatchObject({ codigo: "INTERVALO_INVALIDO" });
  });

  it("no se crean obligaciones en un proyecto cerrado", async () => {
    const { crear, proyectos } = montar();
    const cerrado = proyectoDePrueba({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
      estado: "finalizado",
    });
    proyectos.filas.set(cerrado.id, cerrado);

    await expect(
      crear.ejecutar({
        proyectoId: cerrado.id,
        categoriaId: OPEX,
        concepto: "Tardía",
        valorEstimado: 1_000,
        fechaVencimiento: "2026-08-05",
        frecuencia: "unica",
      }),
    ).rejects.toMatchObject({ codigo: "PROYECTO_CERRADO" });
  });
});

describe("GenerarOcurrencias (RF-52)", () => {
  it("materializa el horizonte y es idempotente (§10.1)", async () => {
    const { generar, obligacion, listarOcurrencias } = await conObligacionMensual();

    const segunda = await generar.ejecutar({ horizonteMeses: 12 });
    const ocurrencias = await listarOcurrencias.ejecutar({ obligacionId: obligacion.id });

    // De agosto de 2026 a julio de 2027 inclusive: doce vencimientos.
    expect(ocurrencias).toHaveLength(12);
    expect(segunda.insertadas).toBe(0);
  });

  it("una obligacion suspendida no genera ocurrencias nuevas (RF-57)", async () => {
    const { cambiarEstado, generar, obligacion, obligaciones, listarOcurrencias } =
      await conObligacionMensual();

    obligaciones.ocurrencias.clear();
    await cambiarEstado.ejecutar({ id: obligacion.id, activa: false });
    const resultado = await generar.ejecutar({ horizonteMeses: 12 });

    expect(resultado.insertadas).toBe(0);
    expect(await listarOcurrencias.ejecutar({ obligacionId: obligacion.id })).toHaveLength(0);
  });

  it("el horizonte se acota entre 1 y 60 meses (RF-101)", async () => {
    const { generar, obligacion, listarOcurrencias } = await conObligacionMensual();
    const obligaciones = await listarOcurrencias.ejecutar({ obligacionId: obligacion.id });
    expect(obligaciones).toHaveLength(12);

    await generar.ejecutar({ horizonteMeses: 999 });
    const tras60 = await listarOcurrencias.ejecutar({ obligacionId: obligacion.id });
    // 999 se recorta a 60 meses: de agosto de 2026 a julio de 2031.
    expect(tras60).toHaveLength(60);
  });
});

describe("PagarOcurrencia (RF-54)", () => {
  it("crea el movimiento con el proyecto, la categoria y el valor de la obligacion", async () => {
    const { pagar, obligaciones, movimientos, obligacion, proyecto } = await conObligacionMensual();
    const primera = [...obligaciones.ocurrencias.values()][0]!;

    const { movimientoId, ocurrencia } = await pagar.ejecutar({
      ocurrenciaId: primera.id,
      metodoPagoId: ID_TRANSFERENCIA,
    });

    const movimiento = await movimientos.buscarPorId(movimientoId);
    expect(ocurrencia.estado).toBe("pagada");
    expect(ocurrencia.movimientoId).toBe(movimientoId);
    expect(movimiento?.aDatos()).toMatchObject({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      naturaleza: "opex",
      valor: 450_000,
      estado: "pagado",
      ocurrenciaId: primera.id,
      descripcion: "Administración del edificio",
    });
    expect(movimiento?.fechaPago).toBe(HOY);
    expect(obligacion.concepto).toBe("Administración del edificio");
  });

  it("admite un valor real distinto del estimado", async () => {
    const { pagar, obligaciones, movimientos } = await conObligacionMensual();
    const primera = [...obligaciones.ocurrencias.values()][0]!;

    const { movimientoId } = await pagar.ejecutar({
      ocurrenciaId: primera.id,
      metodoPagoId: ID_TRANSFERENCIA,
      valor: 480_000,
    });

    expect((await movimientos.buscarPorId(movimientoId))?.dinero.valor).toBe(480_000);
  });

  it("exige el valor cuando el estimado es cero", async () => {
    const { crear, generar, pagar, obligaciones, proyecto } = montar();
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "Servicios públicos",
      valorEstimado: 0,
      fechaVencimiento: "2026-08-15",
      frecuencia: "unica",
    });
    await generar.ejecutar({});
    const ocurrencia = [...obligaciones.ocurrencias.values()][0]!;

    await expect(
      pagar.ejecutar({ ocurrenciaId: ocurrencia.id, metodoPagoId: ID_TRANSFERENCIA }),
    ).rejects.toMatchObject({ codigo: "VALOR_NO_POSITIVO" });
  });

  it("no se paga dos veces la misma ocurrencia", async () => {
    const { pagar, obligaciones } = await conObligacionMensual();
    const primera = [...obligaciones.ocurrencias.values()][0]!;
    await pagar.ejecutar({ ocurrenciaId: primera.id, metodoPagoId: ID_TRANSFERENCIA });

    await expect(
      pagar.ejecutar({ ocurrenciaId: primera.id, metodoPagoId: ID_TRANSFERENCIA }),
    ).rejects.toMatchObject({ codigo: "OCURRENCIA_YA_PAGADA" });
  });

  it("el tipo del movimiento lo decide la naturaleza de la categoria", async () => {
    const { crear, generar, pagar, obligaciones, movimientos, proyecto } = montar();
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CREDITO,
      concepto: "Cuota del crédito",
      valorEstimado: 1_500_000,
      fechaVencimiento: "2026-08-10",
      frecuencia: "mensual",
    });
    await generar.ejecutar({ horizonteMeses: 1 });
    const ocurrencia = [...obligaciones.ocurrencias.values()][0]!;

    const { movimientoId } = await pagar.ejecutar({
      ocurrenciaId: ocurrencia.id,
      metodoPagoId: ID_TRANSFERENCIA,
    });

    expect((await movimientos.buscarPorId(movimientoId))?.naturaleza).toBe("financiacion");
  });
});

describe("CambiarEstadoOcurrencia (RF-56)", () => {
  it("omitir una ocurrencia no afecta a las siguientes", async () => {
    const { cambiarEstadoOcurrencia, obligaciones, listarOcurrencias, obligacion } =
      await conObligacionMensual();
    const [primera, segunda] = [...obligaciones.ocurrencias.values()];

    await cambiarEstadoOcurrencia.ejecutar({ id: primera!.id, omitir: true });

    const ocurrencias = await listarOcurrencias.ejecutar({ obligacionId: obligacion.id });
    expect(ocurrencias.find((o) => o.id === primera!.id)?.estado).toBe("omitida");
    expect(ocurrencias.find((o) => o.id === segunda!.id)?.estado).toBe("pendiente");
  });

  it("una omitida se puede devolver a pendiente, una pagada no", async () => {
    const { cambiarEstadoOcurrencia, pagar, obligaciones } = await conObligacionMensual();
    const [primera, segunda] = [...obligaciones.ocurrencias.values()];

    await cambiarEstadoOcurrencia.ejecutar({ id: primera!.id, omitir: true });
    const reactivada = await cambiarEstadoOcurrencia.ejecutar({ id: primera!.id, omitir: false });
    expect(reactivada.estado).toBe("pendiente");

    await pagar.ejecutar({ ocurrenciaId: segunda!.id, metodoPagoId: ID_TRANSFERENCIA });
    await expect(
      cambiarEstadoOcurrencia.ejecutar({ id: segunda!.id, omitir: true }),
    ).rejects.toMatchObject({ codigo: "OCURRENCIA_YA_PAGADA" });
  });
});

describe("ActualizarEstadosVencidos y agenda (RF-55, RF-58)", () => {
  it("pasa a vencida lo pendiente con fecha anterior a hoy", async () => {
    const { crear, generar, marcarVencidos, obligaciones, proyecto } = montar();
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "Impuesto atrasado",
      valorEstimado: 900_000,
      fechaVencimiento: "2026-06-15",
      frecuencia: "unica",
    });
    await generar.ejecutar({});

    const { actualizados } = await marcarVencidos.ejecutar();

    expect(actualizados).toBe(1);
    expect([...obligaciones.ocurrencias.values()][0]?.estado).toBe("vencida");
  });

  it("la agenda acota la ventana en dias y distingue vencidas", async () => {
    const { crear, generar, marcarVencidos, listarAgenda, proyecto } = montar();
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "Vencida",
      valorEstimado: 100_000,
      fechaVencimiento: "2026-07-01",
      frecuencia: "unica",
    });
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "En cinco días",
      valorEstimado: 200_000,
      fechaVencimiento: "2026-08-04",
      frecuencia: "unica",
    });
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "En dos meses",
      valorEstimado: 300_000,
      fechaVencimiento: "2026-09-30",
      frecuencia: "unica",
    });
    await generar.ejecutar({});
    await marcarVencidos.ejecutar();

    const semana = await listarAgenda.ejecutar({ filtro: { dentroDeDias: 7 } });
    expect(semana.map((e) => e.concepto)).toEqual(["En cinco días"]);

    const semanaConVencidas = await listarAgenda.ejecutar({
      filtro: { dentroDeDias: 7, incluirVencidas: true },
    });
    expect(semanaConVencidas.map((e) => e.concepto)).toEqual(["Vencida", "En cinco días"]);
    expect(semanaConVencidas[0]?.diasRestantes).toBeLessThan(0);
    expect(semanaConVencidas[0]?.estado).toBe("vencida");

    const noventa = await listarAgenda.ejecutar({
      filtro: { dentroDeDias: 90, incluirVencidas: true },
    });
    expect(noventa).toHaveLength(3);
  });
});

describe("Actualizar, suspender y eliminar", () => {
  it("actualizar cambia concepto, valor y frecuencia", async () => {
    const { actualizar, obligacion } = await conObligacionMensual();

    const cambiada = await actualizar.ejecutar({
      id: obligacion.id,
      categoriaId: OPEX,
      concepto: "Administración con reajuste",
      valorEstimado: 500_000,
      fechaVencimiento: "2026-08-05",
      frecuencia: "trimestral",
    });

    expect(cambiada.concepto).toBe("Administración con reajuste");
    expect(cambiada.valorEstimado).toBe(500_000);
    expect(cambiada.frecuencia).toBe("trimestral");
  });

  it("suspender dos veces es un error explicito, no un silencio", async () => {
    const { cambiarEstado, obligacion } = await conObligacionMensual();
    await cambiarEstado.ejecutar({ id: obligacion.id, activa: false });

    await expect(
      cambiarEstado.ejecutar({ id: obligacion.id, activa: false }),
    ).rejects.toMatchObject({ codigo: "OBLIGACION_YA_SUSPENDIDA" });
  });

  it("una obligacion con pagos no se elimina: solo se suspende (ADR-12)", async () => {
    const { eliminar, pagar, obligaciones, obligacion } = await conObligacionMensual();
    const primera = [...obligaciones.ocurrencias.values()][0]!;
    await pagar.ejecutar({ ocurrenciaId: primera.id, metodoPagoId: ID_TRANSFERENCIA });

    await expect(eliminar.ejecutar({ id: obligacion.id })).rejects.toMatchObject({
      codigo: "OBLIGACION_CON_PAGOS",
    });
  });

  it("una obligacion sin pagos se elimina con sus ocurrencias", async () => {
    const { eliminar, obligaciones, obligacion, listar } = await conObligacionMensual();

    await eliminar.ejecutar({ id: obligacion.id });

    expect(obligaciones.eliminados).toEqual([obligacion.id]);
    expect(await listar.ejecutar({})).toHaveLength(0);
    expect(obligaciones.ocurrencias.size).toBe(0);
  });

  it("el listado resume proximo vencimiento y cuenta de vencidas", async () => {
    const { listar, marcarVencidos, obligaciones, crear, generar, proyecto } = montar();
    await crear.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      concepto: "Impuesto",
      valorEstimado: 100_000,
      fechaVencimiento: "2026-06-01",
      frecuencia: "mensual",
    });
    await generar.ejecutar({ horizonteMeses: 3 });
    await marcarVencidos.ejecutar();

    const [fila] = await listar.ejecutar({});
    expect(fila?.ocurrenciasVencidas).toBe(2);
    expect(fila?.proximoVencimiento).toBe("2026-06-01");
    expect(obligaciones.ocurrencias.size).toBeGreaterThan(0);
  });
});

describe("PrevisualizarVencimientos", () => {
  it("previsualiza la serie sin tocar la base", () => {
    const { previsualizar } = montar();

    const fechas = previsualizar.ejecutar({
      fechaVencimiento: "2026-08-05",
      frecuencia: "bimestral",
      horizonteMeses: 6,
    });

    // Horizonte de 6 meses desde el 30 de julio: el limite es el 30 de enero de
    // 2027, asi que el vencimiento de febrero queda fuera.
    expect(fechas).toEqual(["2026-08-05", "2026-10-05", "2026-12-05"]);
  });
});
