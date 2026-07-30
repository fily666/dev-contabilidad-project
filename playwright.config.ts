import { defineConfig, devices } from "@playwright/test";

import { cargarEnv } from "./tests/e2e/utils/entorno";

cargarEnv();

const baseURL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
const puerto = Number(new URL(baseURL).port) || 3000;

/**
 * E2E de los dos escenarios de referencia (Contexto.md §3, §8.8).
 *
 * Corren contra el proyecto Supabase de desarrollo (§15.4): sin Docker no hay
 * base local, asi que las pruebas crean sus propios proyectos con el prefijo
 * `[e2e]` y el teardown los borra. Nunca tocan datos ajenos.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/limpieza.ts",
  // Comparten una sola base: en paralelo se pisarian los totales que verifican.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Entra una vez con el token y guarda la cookie firmada; el resto la reutiliza.
    { name: "sesion", testMatch: /sesion\.setup\.ts/ },
    {
      name: "escritorio",
      dependencies: ["sesion"],
      testIgnore: [/sesion\.setup\.ts/, /responsive\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/estado.json" },
    },
    // RNF-01: a 375 px no debe haber scroll horizontal y las tablas colapsan.
    {
      name: "movil",
      dependencies: ["sesion"],
      testMatch: /responsive\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // 375 px es el ancho que fija RNF-01. Se usa Chromium y no WebKit
        // porque lo que se verifica es la maquetacion, no el motor, y asi CI
        // no descarga un segundo navegador.
        viewport: { width: 375, height: 812 },
        isMobile: false,
        storageState: "tests/e2e/.auth/estado.json",
      },
    },
  ],

  /**
   * El puerto va explicito. Sin `-p`, si algo ocupa el 3000 Next arranca en el
   * 3001 y avisa con un `warn` facil de pasar por alto, mientras Playwright
   * sigue esperando en el 3000 hasta agotar el tiempo: el sintoma es un timeout
   * que no dice nada del motivo. Con el puerto fijo, o se reutiliza el servidor
   * que ya responde o Next falla diciendo que el puerto esta tomado.
   */
  webServer: {
    command: process.env.CI
      ? `npm run build && npm run start -- -p ${puerto}`
      : `npm run dev -- -p ${puerto}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
