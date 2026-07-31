// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CategoriaConRuta } from "../../domain/categoria.repository";
import { SelectorCategoria } from "./selector-categoria";

function categoria(parcial: Partial<CategoriaConRuta> & { id: string; nombre: string }) {
  return {
    ruta: parcial.padreNombre ? `${parcial.padreNombre} › ${parcial.nombre}` : parcial.nombre,
    padreId: null,
    padreNombre: null,
    naturaleza: "opex",
    esSistema: true,
    activa: true,
    esRaiz: parcial.padreId == null,
    tipoProyectoId: null,
    ...parcial,
  } as CategoriaConRuta;
}

const OPERACION = categoria({ id: "r-operacion", nombre: "Operación" });
const ARRIENDO = categoria({
  id: "h-arriendo",
  nombre: "Arriendo",
  padreId: "r-operacion",
  padreNombre: "Operación",
});
const NOMINA = categoria({
  id: "h-nomina",
  nombre: "Nómina",
  padreId: "r-operacion",
  padreNombre: "Operación",
});
/** Raiz sin hijos: existe en el catalogo («Compras» en la captura del reporte). */
const COMPRAS = categoria({ id: "r-compras", nombre: "Compras" });

const CATALOGO = [OPERACION, ARRIENDO, NOMINA, COMPRAS];

/** El valor vive fuera, como en los formularios que lo usan. */
function Anfitrion({
  categorias = CATALOGO,
  inicial = "",
  alCambiar,
  nombrePorTipo,
}: {
  categorias?: CategoriaConRuta[];
  inicial?: string;
  alCambiar?: (id: string) => void;
  nombrePorTipo?: Record<string, string>;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <SelectorCategoria
      categorias={categorias}
      valor={valor}
      nombrePorTipo={nombrePorTipo}
      alCambiar={(id) => {
        setValor(id);
        alCambiar?.(id);
      }}
    />
  );
}

const raiz = () => screen.getByLabelText("Categoría");
const sub = () => screen.getByLabelText("Subcategoría");

describe("SelectorCategoria", () => {
  it("solo ofrece raices en el primer campo, sin rutas «padre › hijo»", async () => {
    const usuario = userEvent.setup();
    render(<Anfitrion />);

    await usuario.click(raiz());

    expect(await screen.findByRole("option", { name: "Operación" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Compras" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Arriendo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /›/ })).not.toBeInTheDocument();
  });

  it("encadena la subcategoria con la raiz elegida y emite el id de la hoja", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<Anfitrion alCambiar={alCambiar} />);

    expect(sub()).toBeDisabled();

    await usuario.click(raiz());
    await usuario.click(await screen.findByRole("option", { name: "Operación" }));

    // La raiz vale por si misma: el campo ya esta completo.
    expect(alCambiar).toHaveBeenLastCalledWith(OPERACION.id);
    expect(sub()).toBeEnabled();

    await usuario.click(sub());
    await usuario.click(await screen.findByRole("option", { name: "Nómina" }));

    expect(alCambiar).toHaveBeenLastCalledWith(NOMINA.id);
    expect(sub()).toHaveTextContent("Nómina");
    expect(raiz()).toHaveTextContent("Operación");
  });

  it("deshabilita la subcategoria cuando la raiz no tiene hijos", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<Anfitrion alCambiar={alCambiar} />);

    await usuario.click(raiz());
    await usuario.click(await screen.findByRole("option", { name: "Compras" }));

    expect(alCambiar).toHaveBeenLastCalledWith(COMPRAS.id);
    expect(sub()).toBeDisabled();
    expect(sub()).toHaveTextContent("Sin subcategorías");
  });

  it("reparte un valor ya guardado entre los dos campos al editar", () => {
    render(<Anfitrion inicial={ARRIENDO.id} />);

    expect(raiz()).toHaveTextContent("Operación");
    expect(sub()).toHaveTextContent("Arriendo");
  });

  it("exige subcategoria cuando la raiz quedo fuera del filtro de naturaleza", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    // Las hojas estan disponibles pero su raiz no: la raiz no es asignable.
    render(<Anfitrion categorias={[ARRIENDO, NOMINA]} alCambiar={alCambiar} />);

    await usuario.click(raiz());
    await usuario.click(await screen.findByRole("option", { name: "Operación" }));

    expect(alCambiar).toHaveBeenLastCalledWith("");
    expect(sub()).toHaveTextContent("Selecciona una subcategoría");

    await usuario.click(sub());
    await screen.findByRole("option", { name: "Arriendo" });
    expect(screen.queryByRole("option", { name: "Sin subcategoría" })).not.toBeInTheDocument();
  });

  it("distingue con el tipo las raices que se llaman igual", async () => {
    const usuario = userEvent.setup();
    // El plan global abarca varios tipos: «Adquisición» existe en los dos.
    const deInmueble = categoria({
      id: "r-adq-inmueble",
      nombre: "Adquisición",
      tipoProyectoId: "t-inmueble",
    });
    const deVehiculo = categoria({
      id: "r-adq-vehiculo",
      nombre: "Adquisición",
      tipoProyectoId: "t-vehiculo",
    });
    render(
      <Anfitrion
        categorias={[deInmueble, deVehiculo, COMPRAS]}
        nombrePorTipo={{ "t-inmueble": "Inmueble", "t-vehiculo": "Vehículo" }}
      />,
    );

    await usuario.click(raiz());

    expect(await screen.findByRole("option", { name: "Adquisición · Inmueble" })).toBeVisible();
    expect(await screen.findByRole("option", { name: "Adquisición · Vehículo" })).toBeVisible();
    // La que no choca se queda con su nombre limpio.
    expect(await screen.findByRole("option", { name: "Compras" })).toBeVisible();
  });
});
