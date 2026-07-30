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
    // Las paginas y rutas no instancian adaptadores: piden el contenedor (§7.5).
    // El cliente de datos usa service_role, y quien lo importe queda obligado a
    // ser codigo de servidor por el `import "server-only"` que lleva dentro; esta
    // regla evita ademas que se cuele por la puerta de atras (§9).
    files: ["src/app/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/shared/infrastructure/supabase/cliente-servidor",
              message:
                "Las paginas y rutas obtienen el acceso a datos del contenedor de @/di/container (Contexto.md §7.5, §9).",
            },
          ],
        },
      ],
    },
  },
  prettier,
];

export default eslintConfig;
