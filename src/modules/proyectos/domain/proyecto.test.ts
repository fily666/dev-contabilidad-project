import { describe, expect, it } from "vitest";
import { ErrorDeDominio } from "@/shared/domain/errores";
import { Proyecto } from "./proyecto.entity";
import { TipoProyecto, leerConfiguracion } from "./tipo-proyecto.entity";

const CONFIG_VEHICULO = leerConfiguracion({
  atributos: [
    { clave: "placa", etiqueta: "Placa", tipo: "text", requerido: true },
    { clave: "modelo", etiqueta: "Modelo", tipo: "number", requerido: false },
    { clave: "asegurado", etiqueta: "Asegurado", tipo: "boolean", requerido: false },
  ],
  indicadores: ["total_invertido", "tco", "costo_mensual"],
  genera_ingresos: false,
  se_valoriza: true,
});

const tipoVehiculo = new TipoProyecto(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "vehiculo",
  "Vehículo",
  "car",
  CONFIG_VEHICULO,
  true,
  true,
);

function codigo(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof ErrorDeDominio) return error.codigo;
    throw error;
  }
  throw new Error("Se esperaba un error de dominio y no se lanzó ninguno.");
}

function crear(cambios: Record<string, unknown> = {}) {
  return Proyecto.crear({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    propietarioId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tipo: tipoVehiculo,
    nombre: "Moto XR 190",
    fechaInicio: "2026-01-15",
    atributos: { placa: "ABC12D" },
    ...cambios,
  });
}

describe("TipoProyecto (§13, RNF-10)", () => {
  it("normaliza la configuracion almacenada en JSONB", () => {
    expect(CONFIG_VEHICULO.atributos).toHaveLength(3);
    expect(CONFIG_VEHICULO.generaIngresos).toBe(false);
    expect(CONFIG_VEHICULO.seValoriza).toBe(true);
  });

  it("tolera configuraciones vacias o malformadas", () => {
    const vacia = leerConfiguracion(null);
    expect(vacia.atributos).toEqual([]);
    expect(vacia.indicadores).toEqual([]);

    const parcial = leerConfiguracion({ atributos: [{ etiqueta: "Sin clave" }, { clave: "ok" }] });
    expect(parcial.atributos).toHaveLength(1);
    expect(parcial.atributos[0]).toEqual({
      clave: "ok",
      etiqueta: "ok",
      tipo: "text",
      requerido: false,
    });
  });

  it("decide la visibilidad de indicadores (§5.4)", () => {
    expect(tipoVehiculo.muestraIndicador("tco")).toBe(true);
    expect(tipoVehiculo.muestraIndicador("cap_rate")).toBe(false);
  });

  it("exige los atributos obligatorios del tipo", () => {
    expect(codigo(() => tipoVehiculo.validarAtributos({}))).toBe("ATRIBUTO_REQUERIDO");
  });

  it("convierte los atributos al tipo declarado", () => {
    const valores = tipoVehiculo.validarAtributos({
      placa: "  ABC12D  ",
      modelo: "2024",
      asegurado: "true",
    });
    expect(valores).toEqual({ placa: "ABC12D", modelo: 2024, asegurado: true });
  });

  it("descarta claves no declaradas por el tipo", () => {
    const valores = tipoVehiculo.validarAtributos({ placa: "ABC12D", inventado: "x" });
    expect(valores).not.toHaveProperty("inventado");
  });

  it("rechaza numeros invalidos", () => {
    expect(codigo(() => tipoVehiculo.validarAtributos({ placa: "ABC12D", modelo: "ayer" }))).toBe(
      "ATRIBUTO_INVALIDO",
    );
  });
});

describe("Proyecto (§5.7)", () => {
  it("nace activo y acepta movimientos", () => {
    const p = crear();
    expect(p.estado).toBe("activo");
    expect(p.aceptaMovimientos()).toBe(true);
    expect(p.moneda).toBe("COP");
  });

  it("valida el nombre", () => {
    expect(codigo(() => crear({ nombre: "   " }))).toBe("NOMBRE_INVALIDO");
    expect(codigo(() => crear({ nombre: "x".repeat(121) }))).toBe("NOMBRE_INVALIDO");
  });

  it("rechaza fecha de cierre anterior al inicio", () => {
    expect(codigo(() => crear({ fechaFin: "2025-12-31" }))).toBe("FECHAS_INCOHERENTES");
  });

  it("rechaza fechas mal formadas", () => {
    expect(codigo(() => crear({ fechaInicio: "15/01/2026" }))).toBe("FECHA_INVALIDA");
  });

  it("un proyecto finalizado o archivado no acepta movimientos (§5.7.7)", () => {
    const p = crear();
    p.cambiarEstado("finalizado", "2026-07-29");
    expect(p.aceptaMovimientos()).toBe(false);

    const q = crear();
    q.cambiarEstado("archivado", "2026-07-29");
    expect(q.aceptaMovimientos()).toBe(false);
  });

  it("un proyecto pausado sigue aceptando movimientos", () => {
    const p = crear();
    p.cambiarEstado("pausado", "2026-07-29");
    expect(p.aceptaMovimientos()).toBe(true);
  });

  it("al finalizar sin fecha de cierre usa la fecha de hoy", () => {
    const p = crear();
    p.cambiarEstado("finalizado", "2026-07-29");
    expect(p.fechaFin).toBe("2026-07-29");
  });

  it("al reactivar un finalizado limpia la fecha de cierre", () => {
    const p = crear();
    p.cambiarEstado("finalizado", "2026-07-29");
    p.cambiarEstado("activo", "2026-08-01");
    expect(p.fechaFin).toBeNull();
    expect(p.aceptaMovimientos()).toBe(true);
  });

  it("respeta una fecha de cierre indicada explicitamente", () => {
    const p = crear({ fechaFin: "2026-06-30" });
    p.cambiarEstado("finalizado", "2026-07-29");
    expect(p.fechaFin).toBe("2026-06-30");
  });

  it("valida los atributos al actualizar", () => {
    const p = crear();
    expect(
      codigo(() =>
        p.actualizar({
          tipo: tipoVehiculo,
          nombre: "Moto XR 190",
          fechaInicio: "2026-01-15",
          atributos: {},
        }),
      ),
    ).toBe("ATRIBUTO_REQUERIDO");
  });

  it("no permite editar un proyecto archivado", () => {
    const p = crear();
    p.cambiarEstado("archivado", "2026-07-29");
    expect(
      codigo(() =>
        p.actualizar({
          tipo: tipoVehiculo,
          nombre: "Otro nombre",
          fechaInicio: "2026-01-15",
          atributos: { placa: "ABC12D" },
        }),
      ),
    ).toBe("PROYECTO_ARCHIVADO");
  });

  it("los atributos expuestos son una copia (no se mutan desde fuera)", () => {
    const p = crear();
    const atributos = p.atributos;
    atributos.placa = "HACK";
    expect(p.atributos.placa).toBe("ABC12D");
  });
});
