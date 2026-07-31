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

import { ActualizarMovimiento } from "./actualizar-movimiento.use-case";
import { AnularMovimiento } from "./anular-movimiento.use-case";
import { ListarMovimientos } from "./listar-movimientos.use-case";
import { MarcarMovimientoPagado } from "./marcar-pagado.use-case";
import { RegistrarMovimiento } from "./registrar-movimiento.use-case";
import { DuplicarMovimiento } from "./duplicar-movimiento.use-case";
import { ImportarMovimientos, PrevisualizarImportacion } from "./importar-movimientos.use-case";
import { MovimientoRepositoryEnMemoria } from "./dobles";

/** Contexto.md §8.8: todos los casos de uso, con repositorios en memoria. */

const CAPEX = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const OPEX = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const INGRESO = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const CREDITO = "cccccccc-cccc-4ccc-8ccc-ccccccccccc4";

function montar() {
  const proyecto = proyectoDePrueba();
  const proyectos = new ProyectoRepositoryEnMemoria();
  proyectos.filas.set(proyecto.id, proyecto);

  const categorias = new CategoriaRepositoryEnMemoria([
    categoriaDePrueba({ id: CAPEX, nombre: "Cuota inicial", naturaleza: "capex" }),
    categoriaDePrueba({ id: OPEX, nombre: "Administración", naturaleza: "opex" }),
    categoriaDePrueba({ id: INGRESO, nombre: "Canon", naturaleza: "ingreso" }),
    categoriaDePrueba({ id: CREDITO, nombre: "Cuota del crédito", naturaleza: "financiacion" }),
  ]);

  const metodosPago = new MetodoPagoRepositoryEnMemoria([metodoTransferencia()]);
  const movimientos = new MovimientoRepositoryEnMemoria();
  const reloj = new RelojFijo("2026-07-30");
  let contador = 0;
  const nuevoId = () => `dddddddd-dddd-4ddd-8ddd-dddddddddd${String(++contador).padStart(2, "0")}`;

  const registrarMovimiento = new RegistrarMovimiento(
    movimientos,
    proyectos,
    categorias,
    reloj,
    nuevoId,
  );
  const previsualizar = new PrevisualizarImportacion(proyectos, categorias, metodosPago);

  return {
    proyecto,
    proyectos,
    categorias,
    metodosPago,
    movimientos,
    reloj,
    registrar: registrarMovimiento,
    actualizar: new ActualizarMovimiento(movimientos, categorias),
    marcarPagado: new MarcarMovimientoPagado(movimientos, metodosPago, reloj),
    anular: new AnularMovimiento(movimientos),
    listar: new ListarMovimientos(movimientos, reloj),
    duplicar: new DuplicarMovimiento(movimientos, reloj, nuevoId),
    previsualizar,
    importar: new ImportarMovimientos(previsualizar, registrarMovimiento),
  };
}

describe("RegistrarMovimiento", () => {
  it("hereda la naturaleza de la categoria y la moneda del proyecto (RF-21, §5.7.5)", async () => {
    const { registrar, proyecto } = montar();

    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      valor: 10_000_000,
      descripcion: "Cuota inicial",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });

    expect(movimiento.naturaleza).toBe("capex");
    expect(movimiento.moneda).toBe("COP");
    expect(movimiento.fecha).toBe("2026-07-30");
    expect(movimiento.esInversion()).toBe(true);
    expect(movimiento.afectaCaja()).toBe(true);
  });

  it("permite sobreescribir la naturaleza propuesta (RF-21)", async () => {
    const { registrar, proyecto } = montar();

    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      naturaleza: "opex",
      valor: 500_000,
      descripcion: "Reclasificado como gasto",
    });

    expect(movimiento.naturaleza).toBe("opex");
    expect(movimiento.esInversion()).toBe(false);
  });

  it("rechaza una categoria incompatible con el tipo (§5.7.3)", async () => {
    const { registrar, proyecto } = montar();

    await expect(
      registrar.ejecutar({
        proyectoId: proyecto.id,
        categoriaId: INGRESO,
        tipo: "egreso",
        valor: 100,
        descripcion: "Incoherente",
      }),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_INCOMPATIBLE" });
  });

  it("rechaza registrar en un proyecto cerrado (§5.7.7)", async () => {
    const { registrar, proyectos } = montar();
    const cerrado = proyectoDePrueba({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
      estado: "archivado",
    });
    proyectos.filas.set(cerrado.id, cerrado);

    await expect(
      registrar.ejecutar({
        proyectoId: cerrado.id,
        categoriaId: OPEX,
        tipo: "egreso",
        valor: 100,
        descripcion: "Tardío",
      }),
    ).rejects.toMatchObject({ codigo: "PROYECTO_CERRADO" });
  });

  it("un pagado sin metodo de pago no se registra (§5.7.4)", async () => {
    const { registrar, proyecto } = montar();

    await expect(
      registrar.ejecutar({
        proyectoId: proyecto.id,
        categoriaId: OPEX,
        tipo: "egreso",
        valor: 100,
        descripcion: "Sin método",
        estado: "pagado",
      }),
    ).rejects.toMatchObject({ codigo: "METODO_PAGO_REQUERIDO" });
  });

  it("exige que capital + intereses iguale la cuota (RF-29)", async () => {
    const { registrar, proyecto } = montar();

    await expect(
      registrar.ejecutar({
        proyectoId: proyecto.id,
        categoriaId: CREDITO,
        tipo: "egreso",
        valor: 1_000_000,
        abonoCapital: 300_000,
        abonoInteres: 500_000,
        descripcion: "Cuota mal desglosada",
      }),
    ).rejects.toMatchObject({ codigo: "DESGLOSE_INVALIDO" });
  });

  it("acepta el desglose correcto de una cuota de credito (RF-29)", async () => {
    const { registrar, proyecto } = montar();

    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CREDITO,
      tipo: "egreso",
      valor: 1_000_000,
      abonoCapital: 300_000,
      abonoInteres: 700_000,
      descripcion: "Cuota de julio",
    });

    expect(movimiento.aDatos().abonoCapital).toBe(300_000);
    expect(movimiento.aDatos().abonoInteres).toBe(700_000);
  });

  it("falla con proyecto o categoria inexistentes", async () => {
    const { registrar, proyecto } = montar();

    await expect(
      registrar.ejecutar({
        proyectoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0",
        categoriaId: OPEX,
        tipo: "egreso",
        valor: 1,
        descripcion: "x",
      }),
    ).rejects.toMatchObject({ codigo: "PROYECTO_NO_ENCONTRADO" });

    await expect(
      registrar.ejecutar({
        proyectoId: proyecto.id,
        categoriaId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc9",
        tipo: "egreso",
        valor: 1,
        descripcion: "x",
      }),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_NO_ENCONTRADO" });
  });
});

describe("ActualizarMovimiento", () => {
  it("cambia categoria, valor y descripcion", async () => {
    const { registrar, actualizar, proyecto } = montar();
    const original = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 100_000,
      descripcion: "Administración julio",
    });

    const actualizado = await actualizar.ejecutar({
      id: original.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      fecha: "2026-07-15",
      valor: 250_000,
      descripcion: "Reclasificado a inversión",
    });

    expect(actualizado.naturaleza).toBe("capex");
    expect(actualizado.dinero.valor).toBe(250_000);
    expect(actualizado.descripcion).toBe("Reclasificado a inversión");
  });

  it("no admite cambios sobre un movimiento anulado (ADR-12)", async () => {
    const { registrar, actualizar, anular, proyecto } = montar();
    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 100_000,
      descripcion: "Se anulará",
    });
    await anular.ejecutar({ id: movimiento.id, motivo: "Registro duplicado" });

    await expect(
      actualizar.ejecutar({
        id: movimiento.id,
        categoriaId: OPEX,
        tipo: "egreso",
        fecha: "2026-07-20",
        valor: 1_000,
        descripcion: "Intento de edición",
      }),
    ).rejects.toMatchObject({ codigo: "MOVIMIENTO_ANULADO" });
  });
});

describe("MarcarMovimientoPagado (RF-26)", () => {
  it("registra fecha de pago y metodo, y usa hoy si no se indica fecha", async () => {
    const { registrar, marcarPagado, proyecto } = montar();
    const pendiente = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 100_000,
      descripcion: "Administración",
      fechaVencimiento: "2026-08-05",
    });

    const pagado = await marcarPagado.ejecutar({
      id: pendiente.id,
      metodoPagoId: ID_TRANSFERENCIA,
    });

    expect(pagado.estado).toBe("pagado");
    expect(pagado.fechaPago).toBe("2026-07-30");
    expect(pagado.afectaCaja()).toBe(true);
  });

  it("rechaza pagar dos veces y exige un metodo existente", async () => {
    const { registrar, marcarPagado, proyecto } = montar();
    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 100_000,
      descripcion: "Administración",
    });
    await marcarPagado.ejecutar({ id: movimiento.id, metodoPagoId: ID_TRANSFERENCIA });

    await expect(
      marcarPagado.ejecutar({ id: movimiento.id, metodoPagoId: ID_TRANSFERENCIA }),
    ).rejects.toMatchObject({ codigo: "MOVIMIENTO_YA_PAGADO" });

    const otro = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 1_000,
      descripcion: "Otro",
    });
    await expect(
      marcarPagado.ejecutar({ id: otro.id, metodoPagoId: "33333333-3333-4333-8333-333333333339" }),
    ).rejects.toMatchObject({ codigo: "METODO_DE_PAGO_NO_ENCONTRADO" });
  });
});

describe("AnularMovimiento (RF-22)", () => {
  it("anular un pagado lo saca de las cifras y conserva el motivo", async () => {
    const { registrar, anular, listar, proyecto } = montar();
    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      valor: 10_000_000,
      descripcion: "Cuota inicial",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });

    const antes = await listar.ejecutar({});
    expect(antes.totales.invertido).toBe(10_000_000);

    const anulado = await anular.ejecutar({ id: movimiento.id, motivo: "Pago duplicado" });

    const despues = await listar.ejecutar({});
    expect(anulado.estado).toBe("anulado");
    expect(anulado.aDatos().motivoAnulacion).toBe("Pago duplicado");
    expect(despues.totales.invertido).toBe(0);
    // El registro sigue siendo consultable (ADR-12).
    expect(despues.total).toBe(1);
  });

  it("exige un motivo de al menos tres caracteres", async () => {
    const { registrar, anular, proyecto } = montar();
    const movimiento = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 1_000,
      descripcion: "x",
    });

    await expect(anular.ejecutar({ id: movimiento.id, motivo: "no" })).rejects.toMatchObject({
      codigo: "MOTIVO_REQUERIDO",
    });
  });
});

describe("ListarMovimientos (RF-23, RF-24)", () => {
  async function conDatos() {
    const contexto = montar();
    const { registrar, proyecto } = contexto;

    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      fecha: "2026-01-10",
      valor: 10_000_000,
      descripcion: "Cuota inicial",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      fecha: "2026-03-05",
      valor: 300_000,
      descripcion: "Administración marzo",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: INGRESO,
      tipo: "ingreso",
      fecha: "2026-04-01",
      valor: 2_000_000,
      descripcion: "Canon abril",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });

    return contexto;
  }

  it("totaliza el conjunto filtrado completo, no solo la pagina", async () => {
    const { listar } = await conDatos();

    const pagina = await listar.ejecutar({ paginacion: { porPagina: 1 } });

    expect(pagina.filas).toHaveLength(1);
    expect(pagina.total).toBe(3);
    expect(pagina.totales).toEqual({
      ingresos: 2_000_000,
      egresos: 10_300_000,
      invertido: 10_000_000,
    });
  });

  it("filtra por tipo, rango de fechas y texto libre", async () => {
    const { listar } = await conDatos();

    const soloIngresos = await listar.ejecutar({ filtro: { tipos: ["ingreso"] } });
    expect(soloIngresos.total).toBe(1);

    const primerTrimestre = await listar.ejecutar({
      filtro: { desde: "2026-01-01", hasta: "2026-03-31" },
    });
    expect(primerTrimestre.total).toBe(2);

    const porTexto = await listar.ejecutar({ filtro: { texto: "canon" } });
    expect(porTexto.total).toBe(1);
  });

  it("ordena por valor y acota la paginacion a los limites del caso de uso", async () => {
    const { listar } = await conDatos();

    const porValor = await listar.ejecutar({
      orden: { campo: "valor", direccion: "desc" },
      paginacion: { pagina: 0, porPagina: 500 },
    });

    expect(porValor.pagina).toBe(1);
    expect(porValor.porPagina).toBe(100);
    expect(porValor.filas[0]?.valor).toBe(10_000_000);
  });
});

describe("DuplicarMovimiento (RF-28)", () => {
  it("la copia nace pendiente y con la fecha de hoy, no pagada", async () => {
    const { registrar, duplicar, proyecto } = montar();
    const original = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      fecha: "2026-01-10",
      valor: 10_000_000,
      descripcion: "Cuota inicial",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });

    const copia = await duplicar.ejecutar({ id: original.id });

    expect(copia.id).not.toBe(original.id);
    expect(copia.estado).toBe("pendiente");
    expect(copia.fecha).toBe("2026-07-30");
    expect(copia.fechaPago).toBeNull();
    expect(copia.descripcion).toBe("Cuota inicial");
    expect(copia.dinero.valor).toBe(10_000_000);
    expect(copia.naturaleza).toBe("capex");
  });

  it("la copia no hereda el vinculo con la ocurrencia del original", async () => {
    const { registrar, duplicar, proyecto } = montar();
    const original = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: OPEX,
      tipo: "egreso",
      valor: 100_000,
      descripcion: "Administración",
      ocurrenciaId: "0c000000-0000-4000-8000-000000000001",
    });

    const copia = await duplicar.ejecutar({ id: original.id });

    expect(original.aDatos().ocurrenciaId).not.toBeNull();
    expect(copia.aDatos().ocurrenciaId).toBeNull();
  });

  it("no duplica un movimiento inexistente", async () => {
    const { duplicar } = montar();

    await expect(
      duplicar.ejecutar({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddd99" }),
    ).rejects.toMatchObject({ codigo: "MOVIMIENTO_NO_ENCONTRADO" });
  });

  it("la copia pendiente no entra en las cifras de caja (regla de oro §2)", async () => {
    const { registrar, duplicar, listar, proyecto } = montar();
    const original = await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      valor: 5_000_000,
      descripcion: "Cuota",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });
    await duplicar.ejecutar({ id: original.id });

    const pagados = await listar.ejecutar({ filtro: { estados: ["pagado"] } });
    const todos = await listar.ejecutar({});

    expect(todos.total).toBe(2);
    expect(pagados.totales.invertido).toBe(5_000_000);
  });
});

describe("Importación CSV (RF-27)", () => {
  const ENCABEZADO =
    "fecha,tipo,categoria,valor,descripcion,metodo_pago,estado,observaciones,proyecto";

  it("resuelve categoría y método de pago por nombre", async () => {
    const { previsualizar, proyecto } = montar();

    const resultado = await previsualizar.ejecutar({
      proyectoId: proyecto.id,
      contenido: [
        ENCABEZADO,
        "2026-03-05,egreso,Administración,450000,Administración marzo,Transferencia,pagado,,",
      ].join("\n"),
    });

    expect(resultado.resumen).toMatchObject({ total: 1, importables: 1, conErrores: 0 });
    expect(resultado.filas[0]?.categoriaId).toBe(OPEX);
    expect(resultado.filas[0]?.metodoPagoId).toBe(ID_TRANSFERENCIA);
  });

  it("señala la categoría inexistente sin descartar el resto del archivo", async () => {
    const { previsualizar, proyecto } = montar();

    const resultado = await previsualizar.ejecutar({
      proyectoId: proyecto.id,
      contenido: [
        ENCABEZADO,
        "2026-03-05,egreso,Categoría inventada,450000,Una,Transferencia,pagado,,",
        "2026-03-06,egreso,Administración,320000,Otra,Transferencia,pagado,,",
      ].join("\n"),
    });

    expect(resultado.resumen).toMatchObject({ total: 2, importables: 1, conErrores: 1 });
    expect(resultado.filas[0]?.errores.join(" ")).toContain("Categoría inventada");
  });

  it("sin proyecto en la fila ni por omisión, la fila no es importable", async () => {
    const { previsualizar } = montar();

    const resultado = await previsualizar.ejecutar({
      contenido: [
        ENCABEZADO,
        "2026-03-05,egreso,Administración,450000,Una,Transferencia,pagado,,",
      ].join("\n"),
    });

    expect(resultado.filas[0]?.importable).toBe(false);
    expect(resultado.filas[0]?.errores.join(" ")).toContain("Falta el proyecto");
  });

  it("importa solo las filas válidas y las cifras cuadran", async () => {
    const { importar, listar, proyecto } = montar();

    const resultado = await importar.ejecutar({
      proyectoId: proyecto.id,
      contenido: [
        ENCABEZADO,
        "2026-03-05,egreso,Cuota inicial,10.000.000,Cuota inicial,Transferencia,pagado,,",
        "no-es-fecha,egreso,Administración,450000,Inválida,Transferencia,pagado,,",
        "2026-03-10,ingreso,Canon,2.000.000,Canon marzo,Transferencia,pagado,,",
      ].join("\n"),
    });

    expect(resultado).toMatchObject({ importados: 2, omitidos: 1, fallidos: [] });

    const pagina = await listar.ejecutar({});
    expect(pagina.total).toBe(2);
    expect(pagina.totales).toEqual({
      ingresos: 2_000_000,
      egresos: 10_000_000,
      invertido: 10_000_000,
    });
  });

  it("un archivo sin columnas obligatorias no se importa a medias", async () => {
    const { importar, proyecto } = montar();

    await expect(
      importar.ejecutar({
        proyectoId: proyecto.id,
        contenido: ["fecha,tipo", "2026-03-05,egreso"].join("\n"),
      }),
    ).rejects.toMatchObject({ codigo: "CSV_INVALIDO" });
  });

  it("si ninguna fila sirve, se dice en lugar de importar cero en silencio", async () => {
    const { importar, proyecto } = montar();

    await expect(
      importar.ejecutar({
        proyectoId: proyecto.id,
        contenido: [ENCABEZADO, "ayer,egreso,Administración,0,Sin valor,,pagado,,"].join("\n"),
      }),
    ).rejects.toMatchObject({ codigo: "CSV_SIN_FILAS_VALIDAS" });
  });

  it("la importación respeta las invariantes: no entra en un proyecto cerrado", async () => {
    const { importar, proyectos } = montar();
    const cerrado = proyectoDePrueba({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
      nombre: "Apartamento archivado",
      estado: "archivado",
    });
    proyectos.filas.set(cerrado.id, cerrado);

    // El proyecto archivado no aparece en el catálogo de proyectos activos, así
    // que la fila que lo nombra no se puede resolver: se rechaza antes de escribir.
    await expect(
      importar.ejecutar({
        contenido: [
          ENCABEZADO,
          "2026-03-05,egreso,Administración,450000,Una,Transferencia,pagado,,Apartamento archivado",
        ].join("\n"),
      }),
    ).rejects.toMatchObject({ codigo: "CSV_SIN_FILAS_VALIDAS" });
  });

  it("dos proyectos con el mismo nombre hacen ambigua la resolución", async () => {
    const { previsualizar, proyectos } = montar();
    const gemelo = proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6" });
    proyectos.filas.set(gemelo.id, gemelo);

    const resultado = await previsualizar.ejecutar({
      contenido: [
        ENCABEZADO,
        "2026-03-05,egreso,Administración,450000,Una,Transferencia,pagado,,Apartamento de prueba",
      ].join("\n"),
    });

    expect(resultado.filas[0]?.importable).toBe(false);
    expect(resultado.filas[0]?.errores.join(" ")).toContain("más de un proyecto");
  });
});
