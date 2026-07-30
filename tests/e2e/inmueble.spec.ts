import { expect, test } from "@playwright/test";

import { crearProyecto, indicador, nombreDePrueba, registrarMovimiento } from "./utils/acciones";

/**
 * Escenario de referencia §3.1 — «Compra de apartamento».
 *
 * Genera ingresos, tiene pasivo y se valoriza. Es la prueba de aceptacion del
 * criterio de cierre de la Fase 1: los movimientos se registran completos y los
 * totales son correctos.
 */
test.describe("§3.1 Inmueble", () => {
  test("registra el histórico y los totales cuadran", async ({ page }) => {
    const nombre = nombreDePrueba("Apartamento 401");

    await crearProyecto(page, {
      tipo: "Inmueble",
      nombre,
      fechaInicio: "2026-01-15",
      atributos: { Dirección: "Calle 100 #15-20", Ciudad: "Bogotá" },
    });

    // CAPEX: incrementa el capital aportado (§2).
    await registrarMovimiento(page, {
      tipo: "Egreso",
      categoria: "Adquisición › Cuota inicial",
      valor: "60000000",
      fecha: "2026-01-20",
      descripcion: "Cuota inicial del apartamento",
      pagado: true,
    });

    // OPEX: sostenimiento, no capitaliza.
    await registrarMovimiento(page, {
      tipo: "Egreso",
      categoria: "Sostenimiento › Administración",
      valor: "450000",
      fecha: "2026-02-05",
      descripcion: "Administración de febrero",
      pagado: true,
    });

    // Ingreso: canon de arrendamiento.
    await registrarMovimiento(page, {
      tipo: "Ingreso",
      categoria: "Arrendamiento › Canon de arrendamiento",
      valor: "2800000",
      fecha: "2026-02-05",
      descripcion: "Canon de febrero",
      pagado: true,
    });

    await page.reload();

    // §5.1: invertido son solo los egresos capex; la administracion no entra.
    await expect(indicador(page, "Total invertido")).toContainText("60");
    await expect(indicador(page, "Total de ingresos")).toContainText("2,8");

    // §5.4: al inmueble le corresponden los indicadores de rentabilidad.
    await expect(indicador(page, "ROI acumulado")).toBeVisible();
    await expect(indicador(page, "Yield neto")).toBeVisible();

    // §5.3: menos de 12 meses de historia ⇒ los anualizados van marcados.
    await expect(page.getByText(/estimad/i).first()).toBeVisible();
  });

  test("un movimiento pendiente no entra en la caja ejecutada", async ({ page }) => {
    const nombre = nombreDePrueba("Apartamento pendiente");

    await crearProyecto(page, {
      tipo: "Inmueble",
      nombre,
      fechaInicio: "2026-01-15",
      atributos: { Dirección: "Carrera 7 #80-10" },
    });

    // Regla de oro §2: comprometido pero no pagado ⇒ no afecta cifras de caja.
    await registrarMovimiento(page, {
      tipo: "Egreso",
      categoria: "Impuestos y seguros › Impuesto predial",
      valor: "1200000",
      fecha: "2026-03-01",
      descripcion: "Predial 2026 sin pagar",
      pagado: false,
    });

    await page.reload();

    // El compromiso existe y se ve, pero no suma a la inversión.
    await expect(indicador(page, "Total invertido")).toContainText("$ 0");

    // La descripción aparece dos veces en el DOM: en la tabla de escritorio y en
    // la variante de tarjetas de móvil, que convive oculta (RNF-01).
    await expect(page.getByText("Predial 2026 sin pagar").first()).toBeVisible();
    await expect(page.getByText("Pendiente").first()).toBeVisible();
  });
});
