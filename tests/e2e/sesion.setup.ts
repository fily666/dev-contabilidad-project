import { expect, test as setup } from "@playwright/test";

import { requerida } from "./utils/entorno";

const ESTADO = "tests/e2e/.auth/estado.json";

/**
 * RF-01: entrar con el token configurado. Se hace una sola vez y se guarda la
 * cookie firmada para el resto de las pruebas (§9.1: la cookie no lleva datos
 * dentro, solo su expiracion firmada, asi que reutilizarla es legitimo).
 */
setup("entra con el token de acceso", async ({ page }) => {
  await page.goto("/acceso");

  await page.getByLabel("Token de acceso").fill(requerida("TOKEN_ACCESO"));
  await page.getByRole("button", { name: "Entrar" }).click();

  // Criterio de aceptacion de RF-01: tras entrar se aterriza en la ruta pedida.
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: ESTADO });
});
