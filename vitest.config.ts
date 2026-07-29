import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Las pruebas de componentes declaran su entorno con
    // `// @vitest-environment jsdom` en la cabecera del archivo.
    coverage: {
      reporter: ["text", "html"],
      include: ["src/modules/*/domain/**", "src/modules/*/application/**", "src/shared/domain/**"],
    },
  },
});
