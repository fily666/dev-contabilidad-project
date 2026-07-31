import { describe, expect, it } from "vitest";
import {
  ProyectoRepositoryEnMemoria,
  proyectoDePrueba,
} from "@/modules/proyectos/application/dobles";

import { consolidar } from "../domain/consolidado";
import type { PatrimonioProyecto } from "../domain/patrimonio.repository";
import {
  AbonarACapital,
  ActualizarPasivo,
  CambiarEstadoPasivo,
  EliminarPasivo,
  EliminarValoracion,
  ListarPasivos,
  ListarValoraciones,
  ObtenerPatrimonio,
  RegistrarPasivo,
  RegistrarValoracion,
} from "./casos-de-uso";
import { PasivoRepositoryEnMemoria, ValoracionRepositoryEnMemoria } from "./dobles";

/** Contexto.md §8.8: casos de uso de patrimonio (RF-16, RF-17, RF-78). */

function montar() {
  const proyecto = proyectoDePrueba({ fechaInicio: "2026-01-15" });
  const proyectos = new ProyectoRepositoryEnMemoria();
  proyectos.filas.set(proyecto.id, proyecto);

  const pasivos = new PasivoRepositoryEnMemoria();
  const valoraciones = new ValoracionRepositoryEnMemoria();
  let contador = 0;
  const nuevoId = () => `0e000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`;

  return {
    proyecto,
    pasivos,
    valoraciones,
    registrarPasivo: new RegistrarPasivo(pasivos, proyectos, nuevoId),
    actualizarPasivo: new ActualizarPasivo(pasivos),
    abonar: new AbonarACapital(pasivos),
    cambiarEstadoPasivo: new CambiarEstadoPasivo(pasivos),
    eliminarPasivo: new EliminarPasivo(pasivos),
    listarPasivos: new ListarPasivos(pasivos),
    registrarValoracion: new RegistrarValoracion(valoraciones, proyectos, nuevoId),
    eliminarValoracion: new EliminarValoracion(valoraciones),
    listarValoraciones: new ListarValoraciones(valoraciones),
    patrimonio: new ObtenerPatrimonio(valoraciones),
  };
}

const CREDITO = {
  nombre: "Crédito hipotecario",
  tipo: "credito_hipotecario" as const,
  montoOriginal: 200_000_000,
  fechaDesembolso: "2026-02-01",
};

describe("Pasivos (RF-17)", () => {
  it("el saldo inicial es el monto original si no se indica otro", async () => {
    const { registrarPasivo, proyecto } = montar();

    const pasivo = await registrarPasivo.ejecutar({ ...CREDITO, proyectoId: proyecto.id });

    expect(pasivo.saldoActual).toBe(200_000_000);
    expect(pasivo.activo).toBe(true);
    expect(pasivo.amortizado).toBe(0);
  });

  it("la tasa se guarda en tanto por uno y se acota", async () => {
    const { registrarPasivo, proyecto } = montar();

    const pasivo = await registrarPasivo.ejecutar({
      ...CREDITO,
      proyectoId: proyecto.id,
      tasaInteresEa: 0.125,
    });
    expect(pasivo.aDatos().tasaInteresEa).toBe(0.125);

    await expect(
      registrarPasivo.ejecutar({ ...CREDITO, proyectoId: proyecto.id, tasaInteresEa: 3 }),
    ).rejects.toMatchObject({ codigo: "TASA_INVALIDA" });
  });

  it("abonar a capital baja el saldo sin tocar el monto original", async () => {
    const { registrarPasivo, abonar, proyecto } = montar();
    const pasivo = await registrarPasivo.ejecutar({ ...CREDITO, proyectoId: proyecto.id });

    const abonado = await abonar.ejecutar({ id: pasivo.id, valor: 50_000_000 });

    expect(abonado.saldoActual).toBe(150_000_000);
    expect(abonado.montoOriginal).toBe(200_000_000);
    expect(abonado.amortizado).toBeCloseTo(0.25, 6);
  });

  it("un abono mayor que el saldo se rechaza", async () => {
    const { registrarPasivo, abonar, proyecto } = montar();
    const pasivo = await registrarPasivo.ejecutar({
      ...CREDITO,
      proyectoId: proyecto.id,
      saldoActual: 1_000_000,
    });

    await expect(abonar.ejecutar({ id: pasivo.id, valor: 2_000_000 })).rejects.toMatchObject({
      codigo: "ABONO_MAYOR_QUE_SALDO",
    });
  });

  it("al saldar el pasivo queda cerrado y deja de sumar", async () => {
    const { registrarPasivo, abonar, listarPasivos, proyecto } = montar();
    const pasivo = await registrarPasivo.ejecutar({
      ...CREDITO,
      proyectoId: proyecto.id,
      saldoActual: 5_000_000,
    });

    const saldado = await abonar.ejecutar({ id: pasivo.id, valor: 5_000_000 });

    expect(saldado.saldoActual).toBe(0);
    expect(saldado.activo).toBe(false);
    expect(await listarPasivos.ejecutar({ soloActivos: true })).toHaveLength(0);
  });

  it("un pasivo con abonos se cierra, no se elimina", async () => {
    const { registrarPasivo, abonar, eliminarPasivo, cambiarEstadoPasivo, proyecto } = montar();
    const pasivo = await registrarPasivo.ejecutar({ ...CREDITO, proyectoId: proyecto.id });
    await abonar.ejecutar({ id: pasivo.id, valor: 10_000_000 });

    await expect(eliminarPasivo.ejecutar({ id: pasivo.id })).rejects.toMatchObject({
      codigo: "PASIVO_CON_HISTORIA",
    });

    const cerrado = await cambiarEstadoPasivo.ejecutar({ id: pasivo.id, activo: false });
    expect(cerrado.activo).toBe(false);
  });

  it("actualizar corrige nombre, saldo y cuota", async () => {
    const { registrarPasivo, actualizarPasivo, proyecto } = montar();
    const pasivo = await registrarPasivo.ejecutar({ ...CREDITO, proyectoId: proyecto.id });

    const actualizado = await actualizarPasivo.ejecutar({
      ...CREDITO,
      id: pasivo.id,
      nombre: "Crédito hipotecario (refinanciado)",
      saldoActual: 180_000_000,
      valorCuota: 2_100_000,
    });

    expect(actualizado.nombre).toBe("Crédito hipotecario (refinanciado)");
    expect(actualizado.saldoActual).toBe(180_000_000);
    expect(actualizado.valorCuota).toBe(2_100_000);
  });
});

describe("Valoraciones (RF-16)", () => {
  it("registra el valor comercial y calcula la variación entre la primera y la última", async () => {
    const { registrarValoracion, listarValoraciones, proyecto } = montar();
    await registrarValoracion.ejecutar({
      proyectoId: proyecto.id,
      fecha: "2026-02-01",
      valor: 300_000_000,
      fuente: "Avalúo comercial",
    });
    await registrarValoracion.ejecutar({
      proyectoId: proyecto.id,
      fecha: "2027-02-01",
      valor: 360_000_000,
    });

    const { filas, variacion } = await listarValoraciones.ejecutar({});

    expect(filas).toHaveLength(2);
    // Más reciente primero.
    expect(filas[0]?.fecha).toBe("2027-02-01");
    expect(variacion).toBeCloseTo(0.2, 6);
  });

  it("una sola valoración no tiene variación con qué compararse", async () => {
    const { registrarValoracion, listarValoraciones, proyecto } = montar();
    await registrarValoracion.ejecutar({
      proyectoId: proyecto.id,
      fecha: "2026-02-01",
      valor: 300_000_000,
    });

    expect((await listarValoraciones.ejecutar({})).variacion).toBeNull();
  });

  it("rechaza una valoración anterior al inicio del proyecto", async () => {
    const { registrarValoracion, proyecto } = montar();

    await expect(
      registrarValoracion.ejecutar({
        proyectoId: proyecto.id,
        fecha: "2025-12-31",
        valor: 100,
      }),
    ).rejects.toMatchObject({ codigo: "VALORACION_ANTERIOR_AL_INICIO" });
  });

  it("dos valoraciones el mismo día son una corrección, no un duplicado", async () => {
    const { registrarValoracion, listarValoraciones, proyecto } = montar();
    await registrarValoracion.ejecutar({
      proyectoId: proyecto.id,
      fecha: "2026-03-01",
      valor: 300_000_000,
    });
    await registrarValoracion.ejecutar({
      proyectoId: proyecto.id,
      fecha: "2026-03-01",
      valor: 310_000_000,
    });

    const { filas } = await listarValoraciones.ejecutar({});
    expect(filas).toHaveLength(1);
    expect(filas[0]?.valor).toBe(310_000_000);
  });

  it("eliminar una valoración inexistente falla explícitamente", async () => {
    const { eliminarValoracion } = montar();

    await expect(
      eliminarValoracion.ejecutar({ id: "0e000000-0000-4000-8000-000000000099" }),
    ).rejects.toMatchObject({ codigo: "VALORACION_NO_ENCONTRADO" });
  });
});

describe("ObtenerPatrimonio (RF-78)", () => {
  const fila = (parciales: Partial<PatrimonioProyecto>): PatrimonioProyecto => ({
    proyectoId: "p1",
    proyecto: "Apartamento",
    estado: "activo",
    moneda: "COP",
    valoracionActual: 300_000_000,
    valoracionFecha: "2026-06-01",
    pasivoTotal: 120_000_000,
    patrimonioNeto: 180_000_000,
    totalInvertido: 200_000_000,
    totalIngresos: 20_000_000,
    totalEgresos: 12_000_000,
    ...parciales,
  });

  it("consolida activos, pasivos y neto, y ordena por patrimonio", async () => {
    const { patrimonio, valoraciones } = montar();
    valoraciones.patrimonioDeclarado = [
      fila({ proyectoId: "p1", patrimonioNeto: 180_000_000 }),
      fila({
        proyectoId: "p2",
        proyecto: "Moto",
        valoracionActual: 15_000_000,
        pasivoTotal: 0,
        patrimonioNeto: 15_000_000,
        totalInvertido: 18_000_000,
        totalIngresos: 0,
        totalEgresos: 20_000_000,
      }),
    ];

    const resultado = await patrimonio.ejecutar({});

    expect(resultado.consolidado.activos).toBe(315_000_000);
    expect(resultado.consolidado.pasivos).toBe(120_000_000);
    expect(resultado.consolidado.patrimonioNeto).toBe(195_000_000);
    expect(resultado.proyectos.map((p) => p.proyectoId)).toEqual(["p1", "p2"]);
    expect(resultado.proyectos[0]?.retorno).not.toBeNull();
  });

  it("un proyecto sin valoración no aporta activo y se dice cuántos hay", () => {
    const consolidado = consolidar([
      fila({ valoracionActual: null, valoracionFecha: null, patrimonioNeto: -120_000_000 }),
    ]);

    expect(consolidado.activos).toBe(0);
    expect(consolidado.sinValoracion).toBe(1);
  });

  it("sin inversión el retorno es null, no infinito (guarda §5.3)", () => {
    const consolidado = consolidar([fila({ totalInvertido: 0, valoracionActual: null })]);

    expect(consolidado.retornoTotal).toBeNull();
  });
});
