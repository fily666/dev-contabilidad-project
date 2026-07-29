# Gestor Financiero de Proyectos Personales

Aplicación web para administrar la inversión, los gastos, los ingresos y las obligaciones de proyectos personales de mediano y largo plazo (un inmueble, un vehículo, un negocio, una inversión). Cada proyecto es una unidad financiera independiente con sus propios indicadores de rentabilidad.

La especificación funcional y técnica completa está en **[Contexto.md](Contexto.md)**. Este README solo cubre cómo levantar y trabajar el proyecto.

---

## Estado actual

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Andamiaje, tooling, esquema de base de datos, RLS, contenedor de dependencias | ✅ completa |
| 1 | Autenticación y perfil, proyectos, catálogos, movimientos, resumen financiero | ✅ completa |
| 2 | Documentos y obligaciones con recurrencia | pendiente |
| 3 | Dashboard con gráficas, calendario, reportes PDF/Excel | pendiente |
| 4 | Pasivos, valoraciones, presupuestos, patrimonio, notificaciones | pendiente |
| 5 | Importación CSV, WhatsApp, nuevos tipos de proyecto | pendiente |

Las tablas, funciones y vistas de **todas** las fases ya existen en la base de datos: las fases siguientes agregan interfaz y casos de uso, no esquema.

En la navegación lateral, los módulos de fases posteriores aparecen deshabilitados con la etiqueta «pronto».

---

## Requisitos

- Node.js 20 o superior (probado con 26)
- Una cuenta de [Supabase](https://supabase.com) con dos proyectos: uno de desarrollo y uno de producción
- **Sin Docker y sin Prisma** (restricción del proyecto, Contexto.md ADR-03 y ADR-04)

---

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
#    Completa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY desde
#    Supabase → Project Settings → API

# 3. Enlazar el proyecto Supabase de desarrollo
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>

# 4. Aplicar migraciones y datos semilla
npm run db:push
npx supabase db push --include-seed     # siembra tipos de proyecto y categorías

# 5. Regenerar los tipos de la base
npm run db:types

# 6. Levantar
npm run dev
```

Abre <http://localhost:3000>, crea una cuenta en `/registro` y el trigger `crear_perfil_al_registrarse` generará tu perfil y tus métodos de pago iniciales.

### Notas de instalación

- **npm 11+ bloquea los scripts de instalación por defecto.** Si `npx supabase` no funciona, ejecuta una vez `npm approve-scripts` (o instala la CLI con `brew install supabase/tap/supabase`).
- `src/shared/infrastructure/supabase/database.types.ts` viene escrito a mano para que el proyecto compile antes del primer enlace. **Sobreescríbelo con `npm run db:types`** en cuanto tengas el proyecto enlazado; a partir de ahí no se edita a mano.
- `npm audit` reporta avisos en dependencias transitivas de tooling (ESLint/minimatch, postcss, sharp). Los arreglos disponibles son cambios mayores o downgrades de Next.js, así que quedan sin aplicar de forma deliberada.

---

## Configuración de Supabase Auth

En el panel de Supabase → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (en producción, tu dominio de Vercel)
- **Redirect URLs:** agrega `http://localhost:3000/auth/confirmar` y `http://localhost:3000/auth/actualizar-clave`

Sin esas URLs, los enlaces de confirmación de correo y de recuperación de contraseña fallarán.

---

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` / `start` | Compilación y ejecución de producción |
| `npm run lint` / `lint:fix` | ESLint (incluye las reglas de frontera hexagonal) |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `test:watch` | Vitest |
| `npm run verify` | typecheck + lint + pruebas (lo que debe pasar antes de subir) |
| `npm run db:push` | Aplica las migraciones al proyecto enlazado |
| `npm run db:seed` | Aplica migraciones y `seed.sql` |
| `npm run db:types` | Regenera `database.types.ts` desde la base |
| `npm run db:reset` | Recrea la base del proyecto enlazado (⚠️ destructivo) |

---

## Pruebas

```bash
npm test
```

Dos niveles, 120 pruebas:

- **Dominio** (`src/**/*.test.ts`): aritmética de `Dinero`, fórmulas de indicadores de §5 con sus guardas contra división por cero, invariantes de `Movimiento` y `Proyecto`, atributos dinámicos por tipo.
- **Esquema** (`tests/db/esquema.test.ts`): ejecuta las migraciones y el seed **reales** contra PostgreSQL embebido ([PGlite](https://pglite.dev)) y verifica restricciones, triggers, vistas de agregación, recurrencias, políticas de Storage y —lo más importante— el **aislamiento por RLS entre usuarios** (RNF-11).

Ese segundo nivel es la alternativa a `supabase start` dado que Docker está descartado: no necesita contenedores ni credenciales, y corre en aproximadamente un segundo.

---

## Arquitectura en dos minutos

```
src/
├── app/                  Next.js App Router — solo presentación
│   ├── (auth)/           login, registro, recuperar/actualizar clave
│   ├── (privado)/        shell con sesión: dashboard, proyectos, movimientos, configuración, perfil
│   └── auth/             callbacks de Supabase Auth
├── modules/<contexto>/
│   ├── domain/           entidades, invariantes, PUERTOS (interfaces). Sin framework.
│   ├── application/      casos de uso. Dependen de puertos, nunca de adaptadores.
│   ├── infrastructure/   ADAPTADORES Supabase + mappers
│   └── presentation/      esquemas Zod, Server Actions, componentes
├── shared/               dominio compartido (Dinero, Reloj, errores), clientes Supabase, UI
├── di/container.ts       ensambla casos de uso y adaptadores por request
└── middleware.ts         refresca la sesión y protege las rutas privadas
```

**Dirección de dependencias:** `presentación → aplicación → dominio ← infraestructura`.

Las fronteras no son solo una convención: `eslint.config.mjs` las hace fallar el lint. El dominio no puede importar React, Next ni Supabase; la aplicación no puede importar adaptadores; y el cliente `service_role` solo es importable desde `src/app/api/cron`.

### Los tres conceptos que hay que entender antes de tocar el código

1. **Naturaleza económica.** Cada movimiento es `capex` (inversión que capitaliza), `opex` (gasto operativo), `financiacion` (deuda) o `ingreso`. Es lo que permite distinguir «cuánto he invertido» de «cuánto he gastado». Se propone desde la categoría y el usuario puede sobreescribirla.
2. **Regla de oro de las cifras.** Solo los movimientos en estado `pagado` alimentan el flujo de caja ejecutado. Los `pendiente`/`vencido` alimentan proyección, calendario y alertas. Nunca se mezclan.
3. **Guarda de indicadores.** Si el divisor es cero, el indicador es `null` y la interfaz muestra «—». Nunca `0 %`, `NaN` ni `Infinity`.

### Agregar un tipo de proyecto nuevo

No requiere migración ni cambios en la lógica existente (RNF-10). Se inserta una fila en `tipos_proyecto` cuya columna `configuracion` (JSONB) declara los atributos propios y los indicadores visibles; el formulario y el panel de indicadores se generan a partir de ahí. Ver Contexto.md §13 y `supabase/seed.sql` como referencia.

### Nota sobre los componentes de interfaz

Los componentes de `src/shared/ui` provienen de shadcn/ui en su estilo actual, que se apoya en **Base UI**. Base UI compone con la prop `render` en lugar de `asChild`:

```tsx
<DropdownMenuTrigger render={<Button variant="ghost" />}>Abrir</DropdownMenuTrigger>
```

Para enlaces con apariencia de botón usa el helper `EnlaceBoton` en vez de combinar `Button` con `Link`.

---

## Despliegue

- **Aplicación:** Vercel. Configura las mismas variables de `.env.example` en el proyecto de Vercel (`SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` como secretas).
- **Base de datos y archivos:** Supabase (proyecto de producción, distinto del de desarrollo).
- Antes de cada despliegue, `npm run verify` debe pasar.
