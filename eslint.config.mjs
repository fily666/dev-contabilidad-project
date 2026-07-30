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
    // La presentacion (paginas, rutas, Server Actions y componentes) solo invoca
    // casos de uso a traves del contenedor (§7.1.4, §7.5). No importa adaptadores
    // ni el cliente de datos: ese cliente usa service_role, y aunque el
    // `import "server-only"` que lleva dentro ya impide que llegue al navegador,
    // esta regla evita que se cuele por la puerta de atras (§9).
    files: ["src/app/**", "src/modules/*/presentation/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/shared/infrastructure/supabase/cliente-servidor",
              message:
                "La presentacion obtiene el acceso a datos del contenedor de @/di/container (Contexto.md §7.5, §9).",
            },
          ],
          patterns: [
            {
              group: ["**/infrastructure/**", "@/modules/*/infrastructure/**"],
              message:
                "La presentacion invoca casos de uso, nunca adaptadores (Contexto.md §7.1.4). Expon el caso de uso en @/di/container.",
            },
          ],
        },
      ],
      /**
       * El contenedor expone casos de uso. Alcanzar `.repositorio` o `.supabase`
       * desde una pagina o una accion salta la capa de aplicacion sin que ningun
       * import lo delate, que es exactamente como se colo antes en los metodos de
       * pago. Se prohibe el acceso, no el import.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^(repositorio|supabase)$/][object.object.name='contenedor']",
          message:
            "No alcances el repositorio ni el cliente desde la presentacion: usa un caso de uso del contenedor (Contexto.md §7.1.4, §7.5).",
        },
        {
          selector: "MemberExpression[object.name='contenedor'][property.name='supabase']",
          message:
            "No uses el cliente de Supabase desde la presentacion: usa un caso de uso del contenedor (Contexto.md §7.1.4, §9).",
        },
      ],
    },
  },
  prettier,
];

export default eslintConfig;
