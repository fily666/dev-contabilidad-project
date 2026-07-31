// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  MAXIMO_SOPORTES_POR_MOVIMIENTO,
  TAMANO_MAXIMO_BYTES,
} from "@/modules/documentos/domain/documento.entity";
import { AdjuntosMovimiento } from "./adjuntos-movimiento";

/** Contexto.md RF-40: seleccion de soportes antes de registrar el movimiento. */

function archivo(nombre: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

const RECIBO = () => archivo("recibo.pdf", "application/pdf", 1024);
const FOTO = () => archivo("foto.jpg", "image/jpeg", 2048);

function Anfitrion() {
  const [archivos, setArchivos] = useState<File[]>([]);
  return <AdjuntosMovimiento archivos={archivos} alCambiar={setArchivos} />;
}

function entradaDeArchivos() {
  return screen.getByLabelText("Soportes del pago");
}

describe("AdjuntosMovimiento", () => {
  it("acepta PDF e imagenes y los lista con su nombre", async () => {
    render(<Anfitrion />);

    await userEvent.upload(entradaDeArchivos(), [RECIBO(), FOTO()]);

    const lista = screen.getByRole("list", { name: "Soportes seleccionados" });
    expect(lista).toHaveTextContent("recibo.pdf");
    expect(lista).toHaveTextContent("foto.jpg");
  });

  it("rechaza un tipo que no es comprobante y dice cual", async () => {
    render(<Anfitrion />);
    const hoja = archivo(
      "cuentas.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      10,
    );

    // `applyAccept: false` salta el filtro del navegador para llegar a la
    // comprobacion del componente, que es la que se esta probando: el `accept`
    // es la primera barrera, no la unica.
    await userEvent.upload(entradaDeArchivos(), [hoja], { applyAccept: false });

    expect(screen.getByText(/«cuentas.xlsx» no es un PDF ni una imagen/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Soportes seleccionados" })).not.toBeInTheDocument();
  });

  it("rechaza el archivo que supera el maximo", async () => {
    render(<Anfitrion />);

    await userEvent.upload(entradaDeArchivos(), [
      archivo("escaneo.pdf", "application/pdf", TAMANO_MAXIMO_BYTES + 1),
    ]);

    expect(screen.getByText(/y el máximo es 20 MB/)).toBeInTheDocument();
  });

  it(`no admite mas de ${MAXIMO_SOPORTES_POR_MOVIMIENTO} y avisa del que queda fuera`, async () => {
    render(<Anfitrion />);

    const demasiados = Array.from({ length: MAXIMO_SOPORTES_POR_MOVIMIENTO + 1 }, (_, i) =>
      archivo(`soporte-${i}.pdf`, "application/pdf", 100),
    );
    await userEvent.upload(entradaDeArchivos(), demasiados);

    const lista = screen.getByRole("list", { name: "Soportes seleccionados" });
    expect(lista.querySelectorAll("li")).toHaveLength(MAXIMO_SOPORTES_POR_MOVIMIENTO);
    expect(
      screen.getByText(
        `«soporte-${MAXIMO_SOPORTES_POR_MOVIMIENTO}.pdf» quedó fuera: máximo ${MAXIMO_SOPORTES_POR_MOVIMIENTO} archivos.`,
      ),
    ).toBeInTheDocument();
    // Alcanzado el tope, el input deja de admitir seleccion.
    expect(entradaDeArchivos()).toBeDisabled();
  });

  it("descarta el duplicado en lugar de subir dos veces el mismo archivo", async () => {
    render(<Anfitrion />);

    await userEvent.upload(entradaDeArchivos(), [RECIBO()]);
    await userEvent.upload(entradaDeArchivos(), [RECIBO()]);

    const lista = screen.getByRole("list", { name: "Soportes seleccionados" });
    expect(lista.querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByText(/«recibo.pdf» ya estaba en la lista/)).toBeInTheDocument();
  });

  it("quitar un soporte lo saca de la lista y libera cupo", async () => {
    render(<Anfitrion />);

    await userEvent.upload(entradaDeArchivos(), [RECIBO(), FOTO()]);
    await userEvent.click(screen.getByRole("button", { name: "Quitar recibo.pdf" }));

    const lista = screen.getByRole("list", { name: "Soportes seleccionados" });
    expect(lista).not.toHaveTextContent("recibo.pdf");
    expect(lista).toHaveTextContent("foto.jpg");
    expect(screen.getByText(/Puedes añadir 6 más/)).toBeInTheDocument();
  });
});
