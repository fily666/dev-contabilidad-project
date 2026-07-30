import { expect, test } from "@playwright/test";

/**
 * RF-01 a RF-04 y §9. Estas pruebas necesitan estar SIN sesion, asi que se
 * declaran con `storageState` vacio y no heredan la del proyecto.
 */
test.describe("Acceso", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sin sesión, una ruta privada redirige a /acceso conservando el destino", async ({
    page,
  }) => {
    await page.goto("/movimientos");

    // Criterio de aceptacion de RF-04.
    await expect(page).toHaveURL(
      /\/acceso\?siguiente=%2Fmovimientos|\/acceso\?siguiente=\/movimientos/,
    );
    await expect(page.getByLabel("Token de acceso")).toBeVisible();
  });

  test("un token incorrecto no entra y no revela nada", async ({ page }) => {
    await page.goto("/acceso");
    await page.getByLabel("Token de acceso").fill("token-que-no-es");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText(/no es correcto/i)).toBeVisible();
    await expect(page).toHaveURL(/\/acceso/);
  });

  test("una cookie alterada invalida la sesión", async ({ page, context }) => {
    // §9.1: la firma se verifica antes de interpretar la carga; cambiar un solo
    // caracter la invalida.
    await context.addCookies([
      {
        name: "gf_sesion",
        value: "9999999999.firmaInventadaQueNoEsUnHmacValido",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/acceso/);
  });
});
