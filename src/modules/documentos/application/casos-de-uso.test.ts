import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";
import {
  ProyectoRepositoryEnMemoria,
  proyectoDePrueba,
} from "@/modules/proyectos/application/dobles";

import { VIGENCIA_FIRMA_SEGUNDOS } from "../domain/almacenamiento";
import { MAXIMO_SOPORTES_POR_MOVIMIENTO, TAMANO_MAXIMO_BYTES } from "../domain/documento.entity";
import {
  EliminarDocumento,
  ListarDocumentos,
  ObtenerUrlDocumento,
  SubirDocumento,
} from "./casos-de-uso";
import { AlmacenamientoEnMemoria, DocumentoRepositoryEnMemoria } from "./dobles";

/** Contexto.md §8.8: casos de uso documentales (RF-40 a RF-47). */

const PDF = "application/pdf";

function montar() {
  const proyecto = proyectoDePrueba();
  const proyectos = new ProyectoRepositoryEnMemoria();
  proyectos.filas.set(proyecto.id, proyecto);

  const documentos = new DocumentoRepositoryEnMemoria();
  const almacenamiento = new AlmacenamientoEnMemoria();
  const reloj = new RelojFijo("2026-07-30");
  let contador = 0;
  const nuevoId = () => `0d000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`;

  return {
    proyecto,
    documentos,
    almacenamiento,
    subir: new SubirDocumento(documentos, proyectos, almacenamiento, reloj, nuevoId),
    listar: new ListarDocumentos(documentos),
    url: new ObtenerUrlDocumento(documentos, almacenamiento),
    eliminar: new EliminarDocumento(documentos, almacenamiento, reloj),
  };
}

function contenido(bytes = 1024): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

describe("SubirDocumento (RF-40 a RF-43)", () => {
  it("sube el objeto y guarda el metadato con la ruta convenida de §6.7", async () => {
    const { subir, almacenamiento, proyecto } = montar();

    const documento = await subir.ejecutar({
      proyectoId: proyecto.id,
      nombreArchivo: "Escritura pública 2026.pdf",
      nombreSeguro: "escritura-publica-2026.pdf",
      mimeType: PDF,
      tamanoBytes: 1024,
      contenido: contenido(),
      tipoDocumento: "escritura",
    });

    expect(documento.rutaStorage).toBe(`${proyecto.id}/${documento.id}-escritura-publica-2026.pdf`);
    expect(almacenamiento.objetos.has(documento.rutaStorage)).toBe(true);
    expect(documento.tipoDocumento).toBe("escritura");
    expect(documento.esPrevisualizable).toBe(true);
  });

  it("rechaza un tipo de archivo fuera del catalogo (RF-42)", async () => {
    const { subir, almacenamiento, proyecto } = montar();

    await expect(
      subir.ejecutar({
        proyectoId: proyecto.id,
        nombreArchivo: "script.sh",
        nombreSeguro: "script.sh",
        mimeType: "application/x-sh",
        tamanoBytes: 10,
        contenido: contenido(10),
      }),
    ).rejects.toMatchObject({ codigo: "TIPO_ARCHIVO_NO_PERMITIDO" });

    // Nada llega al bucket si la entidad rechaza los metadatos.
    expect(almacenamiento.objetos.size).toBe(0);
  });

  it("rechaza mas de 20 MB (RF-42)", async () => {
    const { subir, proyecto } = montar();

    await expect(
      subir.ejecutar({
        proyectoId: proyecto.id,
        nombreArchivo: "grande.pdf",
        nombreSeguro: "grande.pdf",
        mimeType: PDF,
        tamanoBytes: TAMANO_MAXIMO_BYTES + 1,
        contenido: contenido(16),
      }),
    ).rejects.toMatchObject({ codigo: "ARCHIVO_DEMASIADO_GRANDE" });
  });

  it("un movimiento no admite mas de siete soportes (RF-40)", async () => {
    const { subir, almacenamiento, proyecto } = montar();
    const movimientoId = "dddddddd-dddd-4ddd-8ddd-dddddddddd07";

    async function adjuntar(numero: number) {
      return subir.ejecutar({
        proyectoId: proyecto.id,
        movimientoId,
        nombreArchivo: `soporte-${numero}.pdf`,
        nombreSeguro: `soporte-${numero}.pdf`,
        mimeType: PDF,
        tamanoBytes: 100,
        contenido: contenido(100),
      });
    }

    for (let i = 1; i <= MAXIMO_SOPORTES_POR_MOVIMIENTO; i += 1) await adjuntar(i);

    await expect(adjuntar(MAXIMO_SOPORTES_POR_MOVIMIENTO + 1)).rejects.toMatchObject({
      codigo: "DEMASIADOS_SOPORTES",
    });

    // El octavo se rechaza antes de tocar el bucket.
    expect(almacenamiento.objetos.size).toBe(MAXIMO_SOPORTES_POR_MOVIMIENTO);
  });

  it("el tope es por movimiento: otro movimiento del mismo proyecto empieza de cero", async () => {
    const { subir, proyecto } = montar();

    async function adjuntar(movimientoId: string, numero: number) {
      return subir.ejecutar({
        proyectoId: proyecto.id,
        movimientoId,
        nombreArchivo: `soporte-${numero}.pdf`,
        nombreSeguro: `soporte-${numero}.pdf`,
        mimeType: PDF,
        tamanoBytes: 100,
        contenido: contenido(100),
      });
    }

    for (let i = 1; i <= MAXIMO_SOPORTES_POR_MOVIMIENTO; i += 1) {
      await adjuntar("dddddddd-dddd-4ddd-8ddd-dddddddddd11", i);
    }

    await expect(adjuntar("dddddddd-dddd-4ddd-8ddd-dddddddddd12", 1)).resolves.toBeDefined();
  });

  it("si falla la escritura de la fila, el objeto no queda huerfano", async () => {
    const { subir, documentos, almacenamiento, proyecto } = montar();
    documentos.fallarAlGuardar = true;

    await expect(
      subir.ejecutar({
        proyectoId: proyecto.id,
        nombreArchivo: "factura.pdf",
        nombreSeguro: "factura.pdf",
        mimeType: PDF,
        tamanoBytes: 2048,
        contenido: contenido(2048),
      }),
    ).rejects.toThrow();

    expect(almacenamiento.objetos.size).toBe(0);
  });

  it("no se sube nada a un proyecto inexistente", async () => {
    const { subir } = montar();

    await expect(
      subir.ejecutar({
        proyectoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
        nombreArchivo: "x.pdf",
        nombreSeguro: "x.pdf",
        mimeType: PDF,
        tamanoBytes: 10,
        contenido: contenido(10),
      }),
    ).rejects.toMatchObject({ codigo: "PROYECTO_NO_ENCONTRADO" });
  });
});

describe("ObtenerUrlDocumento (RF-44, RF-45)", () => {
  it("firma la URL con 60 minutos de vigencia", async () => {
    const { subir, url, almacenamiento, proyecto } = montar();
    const documento = await subir.ejecutar({
      proyectoId: proyecto.id,
      nombreArchivo: "recibo.pdf",
      nombreSeguro: "recibo.pdf",
      mimeType: PDF,
      tamanoBytes: 512,
      contenido: contenido(512),
    });

    const firmada = await url.ejecutar({ id: documento.id });

    expect(firmada.url).toContain(documento.rutaStorage);
    expect(firmada.nombreArchivo).toBe("recibo.pdf");
    expect(almacenamiento.firmas[0]?.segundos).toBe(VIGENCIA_FIRMA_SEGUNDOS);
  });

  it("un soporte eliminado ya no se puede firmar", async () => {
    const { subir, url, eliminar, proyecto } = montar();
    const documento = await subir.ejecutar({
      proyectoId: proyecto.id,
      nombreArchivo: "recibo.pdf",
      nombreSeguro: "recibo.pdf",
      mimeType: PDF,
      tamanoBytes: 512,
      contenido: contenido(512),
    });
    await eliminar.ejecutar({ id: documento.id });

    await expect(url.ejecutar({ id: documento.id })).rejects.toMatchObject({
      codigo: "DOCUMENTO_NO_ENCONTRADO",
    });
  });
});

describe("EliminarDocumento (RF-46)", () => {
  it("borra el objeto y marca la fila, que deja de listarse", async () => {
    const { subir, eliminar, listar, documentos, almacenamiento, proyecto } = montar();
    const documento = await subir.ejecutar({
      proyectoId: proyecto.id,
      nombreArchivo: "contrato.pdf",
      nombreSeguro: "contrato.pdf",
      mimeType: PDF,
      tamanoBytes: 4096,
      contenido: contenido(4096),
      tipoDocumento: "contrato",
    });

    const { proyectoId } = await eliminar.ejecutar({ id: documento.id });

    expect(proyectoId).toBe(proyecto.id);
    expect(almacenamiento.objetos.size).toBe(0);
    // Borrado logico: la fila sigue existiendo (ADR-12) pero no se lista.
    expect(documentos.filas.get(documento.id)?.eliminado).toBe(true);
    expect(await listar.ejecutar({})).toHaveLength(0);
  });

  it("eliminar dos veces es un error, no un silencio", async () => {
    const { subir, eliminar, proyecto } = montar();
    const documento = await subir.ejecutar({
      proyectoId: proyecto.id,
      nombreArchivo: "poliza.pdf",
      nombreSeguro: "poliza.pdf",
      mimeType: PDF,
      tamanoBytes: 100,
      contenido: contenido(100),
    });
    await eliminar.ejecutar({ id: documento.id });

    await expect(eliminar.ejecutar({ id: documento.id })).rejects.toMatchObject({
      codigo: "DOCUMENTO_NO_ENCONTRADO",
    });
  });
});

describe("ListarDocumentos (RF-47)", () => {
  it("filtra por tipo, por texto y por soportes de proyecto", async () => {
    const { subir, listar, proyecto } = montar();
    await subir.ejecutar({
      proyectoId: proyecto.id,
      nombreArchivo: "Escritura.pdf",
      nombreSeguro: "escritura.pdf",
      mimeType: PDF,
      tamanoBytes: 100,
      contenido: contenido(100),
      tipoDocumento: "escritura",
    });
    await subir.ejecutar({
      proyectoId: proyecto.id,
      movimientoId: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
      nombreArchivo: "Factura ferretería.jpg",
      nombreSeguro: "factura-ferreteria.jpg",
      mimeType: "image/jpeg",
      tamanoBytes: 200,
      contenido: contenido(200),
      tipoDocumento: "factura",
    });

    expect(await listar.ejecutar({ filtro: { tipos: ["escritura"] } })).toHaveLength(1);
    expect(await listar.ejecutar({ filtro: { texto: "ferrete" } })).toHaveLength(1);
    expect(await listar.ejecutar({ filtro: { soloDeProyecto: true } })).toHaveLength(1);
    expect(
      await listar.ejecutar({ filtro: { movimientoId: "dddddddd-dddd-4ddd-8ddd-dddddddddd01" } }),
    ).toHaveLength(1);
  });
});
