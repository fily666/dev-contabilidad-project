import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Reglas de frontera de la arquitectura hexagonal (Contexto.md §7.1).
 * Direccion de dependencias: presentacion -> aplicacion -> dominio <- infraestructura.
 */
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "src/shared/infrastructure/supabase/database.types.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // El dominio es puro: sin framework, sin Supabase, sin React.
    files: ["src/modules/*/domain/**", "src/shared/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "next",
                "next/**",
                "@supabase/**",
                "**/infrastructure/**",
                "**/presentation/**",
                "**/application/**",
                "@/shared/ui/**",
              ],
              message:
                "El dominio no puede depender de framework, infraestructura ni presentacion (Contexto.md §7.1).",
            },
          ],
        },
      ],
    },
  },
  {
    // La aplicacion orquesta el dominio a traves de puertos, nunca adaptadores.
    files: ["src/modules/*/application/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/**",
                "@supabase/**",
                "**/infrastructure/**",
                "**/presentation/**",
                "@/shared/ui/**",
              ],
              message:
                "Los casos de uso dependen de puertos, no de adaptadores ni del framework (Contexto.md §7.1).",
            },
          ],
        },
      ],
    },
  },
  {
    // Solo las tareas cron pueden usar el cliente administrativo (service_role).
    files: ["src/app/**"],
    ignores: ["src/app/api/cron/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/shared/infrastructure/supabase/admin",
              message:
                "El cliente service_role solo puede usarse en /api/cron (Contexto.md §9).",
            },
          ],
        },
      ],
    },
  },
  prettier,
];

export default eslintConfig;
