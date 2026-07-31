import { describe, expect, it } from "vitest";

import {
  ActualizarMetodoPago,
  CrearMetodoPago,
  EliminarMetodoPago,
  ListarMetodosPago,
} from "./casos-de-uso";
import { ID_TRANSFERENCIA, MetodoPagoRepositoryEnMemoria, metodoTransferencia } from "./dobles";

/** Contexto.md §8.8: casos de uso del catalogo de metodos de pago (RF-33). */

function montar() {
  const metodosPago = new MetodoPagoRepositoryEnMemoria([metodoTransferencia()]);
  let contador = 0;
  const nuevoId = () => `ffffffff-ffff-4fff-8fff-ffffffffff${String(++contador).padStart(2, "0")}`;

  return {
    metodosPago,
    listar: new ListarMetodosPago(metodosPago),
    crear: new CrearMetodoPago(metodosPago, nuevoId),
    actualizar: new ActualizarMetodoPago(metodosPago),
    eliminar: new EliminarMetodoPago(metodosPago),
  };
}

describe("CrearMetodoPago", () => {
  it("crea el metodo activo y con los ultimos digitos normalizados", async () => {
    const { crear } = montar();

    const metodo = await crear.ejecutar({
      nombre: "Tarjeta Visa",
      tipo: "tarjeta_credito",
      ultimosDigitos: " 4321 ",
    });

    expect(metodo).toMatchObject({ nombre: "Tarjeta Visa", activo: true, ultimosDigitos: "4321" });
  });

  it("rechaza nombres duplicados", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({ nombre: "transferencia", tipo: "transferencia" }),
    ).rejects.toMatchObject({ codigo: "METODO_PAGO_DUPLICADO" });
  });

  it("rechaza unos ultimos digitos que no sean de 2 a 4 cifras", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({ nombre: "Tarjeta rara", tipo: "tarjeta_debito", ultimosDigitos: "12345" }),
    ).rejects.toMatchObject({ codigo: "ULTIMOS_DIGITOS_INVALIDOS" });
  });
});

describe("ActualizarMetodoPago", () => {
  it("renombra, cambia el tipo y permite desactivar", async () => {
    const { actualizar } = montar();

    const metodo = await actualizar.ejecutar({
      id: ID_TRANSFERENCIA,
      nombre: "Transferencia PSE",
      tipo: "debito_automatico",
      activo: false,
    });

    expect(metodo).toMatchObject({
      nombre: "Transferencia PSE",
      tipo: "debito_automatico",
      activo: false,
    });
  });

  it("falla si el metodo no existe", async () => {
    const { actualizar } = montar();

    await expect(
      actualizar.ejecutar({
        id: "33333333-3333-4333-8333-333333333339",
        nombre: "X",
        tipo: "efectivo",
      }),
    ).rejects.toMatchObject({ codigo: "METODO_DE_PAGO_NO_ENCONTRADO" });
  });

  it("no permite renombrar a un nombre ya usado por otro metodo", async () => {
    const { crear, actualizar } = montar();
    const efectivo = await crear.ejecutar({ nombre: "Efectivo", tipo: "efectivo" });

    await expect(
      actualizar.ejecutar({ id: efectivo.id, nombre: "Transferencia", tipo: "efectivo" }),
    ).rejects.toMatchObject({ codigo: "METODO_PAGO_DUPLICADO" });
  });
});

describe("EliminarMetodoPago", () => {
  it("elimina un metodo sin movimientos asociados", async () => {
    const { eliminar, metodosPago } = montar();

    await eliminar.ejecutar({ id: ID_TRANSFERENCIA });

    expect(metodosPago.eliminados).toEqual([ID_TRANSFERENCIA]);
  });

  it("un metodo en uso se desactiva, no se elimina", async () => {
    const { eliminar, metodosPago } = montar();
    metodosPago.movimientosPorMetodo.set(ID_TRANSFERENCIA, 7);

    await expect(eliminar.ejecutar({ id: ID_TRANSFERENCIA })).rejects.toMatchObject({
      codigo: "METODO_PAGO_EN_USO",
    });
  });
});

describe("ListarMetodosPago", () => {
  it("por omision devuelve solo los activos; con soloActivos=false devuelve todos", async () => {
    const { listar, actualizar } = montar();
    await actualizar.ejecutar({
      id: ID_TRANSFERENCIA,
      nombre: "Transferencia",
      tipo: "transferencia",
      activo: false,
    });

    expect(await listar.ejecutar()).toHaveLength(0);
    expect(await listar.ejecutar({ soloActivos: false })).toHaveLength(1);
  });
});
