# Gestor Financiero de Proyectos Personales

Aplicación web para administrar la inversión, los gastos, los ingresos y las obligaciones de proyectos personales de mediano y largo plazo (un inmueble, un vehículo, un negocio, una inversión). Cada proyecto es una unidad financiera independiente con sus propios indicadores de rentabilidad.

**Es un sistema de un solo dueño.** No hay cuentas, registro ni perfiles: se entra con un token configurado en el entorno.

La especificación funcional y técnica completa está en **[Contexto.md](Contexto.md)**. Este README solo cubre cómo levantar y trabajar el proyecto.

---

## Estado actual

| Fase | Alcance                                                                            | Estado      |
| ---- | ---------------------------------------------------------------------------------- | ----------- |
| 0    | Andamiaje, tooling, esquema de base de datos, blindaje, contenedor de dependencias | ✅ completa |
| 1    | Acceso por token, ajustes, proyectos, catálogos, movimientos, resumen financiero   | ✅ completa |
| 2    | Documentos y obligaciones con recurrencia, tareas programadas                      | ✅ completa |
| 3    | Dashboard sobre las vistas, calendario, reportes con Excel y PDF                   | ✅ completa |
| 4    | Pasivos, valoraciones, presupuestos, patrimonio, notificaciones por correo         | ✅ completa |
| 5    | Importación CSV, exportación JSON, tipos de proyecto nuevos                        | ✅ completa |

Falta, y no es alcance: decidir el proveedor de WhatsApp (§17.3), habilitar los backups
diarios de Supabase (RNF-15) y correr la auditoría de accesibilidad y de Lighthouse
(RNF-04, RNF-05), que se miden fuera del repositorio.

Las tablas, funciones y vistas de **todas** las fases existen en la base de datos. Las
únicas migraciones posteriores al esquema inicial agregan vistas de agregación
(`v_movimientos_mensual`, `v_gastos_mensual_categoria`, `v_presupuesto_ejecucion`), para
que el rango de fechas del panel y el comparativo de presupuestos se calculen en SQL una
sola vez (ADR-11).

---

## Requisitos

- Node.js 20 o superior (probado con 26)
- Una cuenta de [Supabase](https://supabase.com)
- **Sin Docker y sin Prisma** (restricción del proyecto, Contexto.md ADR-03 y ADR-04)

---

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env
#    TOKEN_ACCESO               → el token con el que entrarás (ver "Sobre el token" abajo)
#    SECRETO_SESION             → node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
#    NEXT_PUBLIC_SUPABASE_URL   → Project Settings → API
#    SUPABASE_SERVICE_ROLE_KEY  → Project Settings → API (service_role)
#    SUPABASE_DB_URL            → Project Settings → Database → Connection string (URI)

# 3. Aplicar migraciones y datos semilla
npm run db:seed

# 4. Comprobar el resultado
npm run db:inspect          # tablas, RLS, blindaje de permisos, semillas
npm run db:verify-types     # los tipos TS coinciden con el esquema real

# 5. Levantar
npm run dev
```

Abre <http://localhost:3000>, escribe el token y ya estás dentro. No hay que crear nada: la semilla deja los 5 tipos de proyecto, las 83 categorías, los 4 métodos de pago y la fila de ajustes.

### Sobre el token

`TOKEN_ACCESO` es la **única** barrera entre internet y todo tu historial financiero. Conviene que sea una cadena aleatoria larga:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Un valor con forma de contraseña común (`Admin123!` y familia) es exactamente el patrón que los ataques por diccionario prueban primero, y aquí no hay una segunda barrera detrás. El razonamiento completo está en [Contexto.md §9.4](Contexto.md).

**Cambiar el token cierra las sesiones abiertas**, no solo impide entradas nuevas: la clave con que se firma la cookie se deriva del token vigente. Rotarlo es cambiar una variable de entorno y reiniciar, nada más.

### Notas de instalación

- **npm 11+ bloquea los scripts de instalación por defecto.** Si `npx supabase` no funciona, ejecuta una vez `npm approve-scripts` (o instala la CLI con `brew install supabase/tap/supabase`).
- **La región importa en la cadena de conexión.** El host del pooler incluye la región del proyecto (`aws-0-ca-central-1.pooler.supabase.com`, no `us-west-2`). Con la región equivocada el error es `tenant/user postgres.<ref> not found`, que parece un problema de credenciales pero no lo es. Cópiala del panel, no de otro proyecto.
- **Sin Docker, tres subcomandos de la CLI no funcionan:** `supabase db dump`, `supabase db diff` y `supabase gen types --db-url`. Los scripts de [scripts/](scripts/) cubren esas necesidades con `postgres.js` (`db:inspect`, `db:verify-types`, `db:smoke`, `db:reset`). Para regenerar los tipos con la CLI hace falta `supabase login` + `supabase link` y usar `npm run db:types`, que va por la API y no por Docker.
- `src/shared/infrastructure/supabase/database.types.ts` está escrito a mano, pero **verificado**: `npm run db:verify-types` contrasta cada columna y su nulabilidad contra la base real. Ejecútalo después de cada migración.
- **No hace falta configurar nada en Supabase Auth.** No se usa: no hay usuarios, ni correos de confirmación, ni URLs de redirección.
- `npm audit` reporta avisos en dependencias transitivas de tooling (ESLint/minimatch, postcss, sharp). Los arreglos disponibles son cambios mayores o downgrades de Next.js, así que quedan sin aplicar de forma deliberada.

---

## Cómo está cerrada la base

Merece un apartado porque es donde más se aparta el proyecto de lo habitual en Supabase.

Al no haber usuarios, no hay nada que aislar con RLS: no existen filas de otro. Así que en lugar de políticas `propietario_id = auth.uid()`, el esquema hace algo más simple y más estricto:

- **RLS activo en las 14 tablas y cero políticas** → cualquier rol sin `BYPASSRLS` no ve ni escribe una fila.
- **`anon` y `authenticated` sin ningún permiso** → la API REST del proyecto no expone nada. No hay clave anónima configurada ni se usa.
- **La aplicación entra con `service_role`**, siempre desde el servidor. El módulo que lee esa clave lleva `import "server-only"`: si un componente de cliente lo importara, el build falla en vez de filtrarla.
- **El catálogo del sistema lo protege un trigger**, no una política. Es más fuerte: tampoco puede saltárselo un script conectado como `postgres`.

La contrapartida, dicha sin adornos: la barrera real es el token, no la base de datos.

`npm run db:inspect` verifica todo esto y **falla** si aparece cualquier permiso para un rol público. Vale la pena ejecutarlo después de cada migración.

---

## Scripts

| Script                            | Qué hace                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo (Turbopack)                                                       |
| `npm run build` / `start`         | Compilación y ejecución de producción                                                    |
| `npm run lint` / `lint:fix`       | ESLint (incluye las reglas de frontera hexagonal)                                        |
| `npm run format` / `format:check` | Prettier                                                                                 |
| `npm run typecheck`               | `tsc --noEmit`                                                                           |
| `npm test` / `test:watch`         | Vitest                                                                                   |
| `npm run verify`                  | typecheck + lint + pruebas (lo que debe pasar antes de subir)                            |
| `npm run db:push`                 | Aplica las migraciones pendientes a `SUPABASE_DB_URL`                                    |
| `npm run db:seed`                 | Aplica migraciones y `seed.sql`                                                          |
| `npm run db:reset`                | Borra el esquema y lo reconstruye desde cero; se niega si hay datos propios              |
| `npm run db:inspect`              | Tablas, RLS, vistas, triggers, semillas y blindaje de permisos                           |
| `npm run db:verify-types`         | Contrasta `database.types.ts` con el esquema real (falla si difieren)                    |
| `npm run db:smoke`                | Prueba de humo end-to-end contra la base remota; se niega a correr si hay datos          |
| `npm run db:types`                | Regenera `database.types.ts` vía la API de Supabase (requiere `supabase login` + `link`) |

Los scripts de base leen `SUPABASE_DB_URL` desde `.env` con `node --env-file`, así que la contraseña no aparece en `package.json` ni en el historial del shell.

---

## Pruebas

```bash
npm test
```

Dos niveles, 157 pruebas:

- **Dominio y aplicación** (`src/**/*.test.ts`): aritmética de `Dinero`, fórmulas de indicadores de §5 con sus guardas contra división por cero, invariantes de `Movimiento` y `Proyecto`, atributos dinámicos por tipo, firma y verificación de la sesión, y el freno a la fuerza bruta.
- **Esquema** (`tests/db/esquema.test.ts`): ejecuta las migraciones y el seed **reales** contra PostgreSQL embebido ([PGlite](https://pglite.dev)) y verifica restricciones, triggers, vistas de agregación, recurrencias, la protección del catálogo del sistema y —lo más importante— que los roles públicos no tengan acceso a nada (RNF-11).

Ese segundo nivel es la alternativa a `supabase start` dado que Docker está descartado: no necesita contenedores ni credenciales, y corre en aproximadamente un segundo.

Dos pruebas que parecen rebuscadas y no lo son:

- **«un objeto nuevo en public tampoco queda al alcance de anon»** comprueba que `alter default privileges` funcionó. Sin eso, la próxima tabla o función que se agregue nace concedida a los roles públicos y el blindaje se erosiona migración a migración sin que nadie lo note. Hizo falta para descubrir que `alter default privileges ... in schema public revoke execute on functions from public` **no hace nada**: el `EXECUTE` a `PUBLIC` es un valor por omisión global y solo la variante sin `in schema` lo revoca.
- **«cambiar el token invalida la sesión en curso»** comprueba que rotar `TOKEN_ACCESO` cierra lo que ya estaba abierto. Si no, quien tuviera una cookie viva seguiría dentro después del cambio, que es justo lo contrario de lo que uno espera al rotar una credencial.

A eso se suma `npm run db:smoke`, que repite las comprobaciones críticas contra el Supabase real (semillas, cifras, invariantes, protección del catálogo, blindaje) y limpia lo que crea. Vale la pena porque PGlite no puede cubrir lo que vive fuera del esquema `public`: los triggers de `storage`, el historial de migraciones de la CLI, el pooler.

---

## Arquitectura en dos minutos

```
src/
├── app/                  Next.js App Router — solo presentación
│   ├── (auth)/acceso/    única pantalla pública: el token
│   ├── (privado)/        shell con sesión: dashboard, proyectos, movimientos, configuración
│   └── api/cron/         tareas programadas (Fase 2+)
├── modules/<contexto>/
│   ├── domain/           entidades, invariantes, PUERTOS (interfaces). Sin framework.
│   ├── application/      casos de uso. Dependen de puertos, nunca de adaptadores.
│   ├── infrastructure/   ADAPTADORES Supabase + mappers
│   └── presentation/     esquemas Zod, Server Actions, componentes
├── shared/               dominio compartido (Dinero, Reloj, errores), cliente Supabase, UI
├── di/container.ts       ensambla casos de uso y adaptadores por request
└── middleware.ts         verifica la cookie firmada y protege las rutas privadas
```

**Dirección de dependencias:** `presentación → aplicación → dominio ← infraestructura`.

Las fronteras no son solo una convención: `eslint.config.mjs` las hace fallar el lint. El dominio no puede importar React, Next ni Supabase; la aplicación no puede importar adaptadores; y las páginas no pueden instanciar el cliente de datos: piden el contenedor.

### Los cuatro conceptos que hay que entender antes de tocar el código

1. **Naturaleza económica.** Cada movimiento es `capex` (inversión que capitaliza), `opex` (gasto operativo), `financiacion` (deuda) o `ingreso`. Es lo que permite distinguir «cuánto he invertido» de «cuánto he gastado». Se propone desde la categoría y se puede sobreescribir.
2. **Regla de oro de las cifras.** Solo los movimientos en estado `pagado` alimentan el flujo de caja ejecutado. Los `pendiente`/`vencido` alimentan proyección, calendario y alertas. Nunca se mezclan.
3. **Guarda de indicadores.** Si el divisor es cero, el indicador es `null` y la interfaz muestra «—». Nunca `0 %`, `NaN` ni `Infinity`.
4. **Fila del sistema.** Lo que sembró `seed.sql` lleva `es_sistema = true` y no se puede modificar ni eliminar, solo ocultar. Lo garantiza un trigger, con una única puerta de escape declarada (`set app.sembrando = 'on'`) que usa la propia semilla.

### Agregar un tipo de proyecto nuevo

No requiere migración ni cambios en la lógica existente (RNF-10). Se inserta una fila en `tipos_proyecto` cuya columna `configuracion` (JSONB) declara los atributos propios y los indicadores visibles; el formulario y el panel de indicadores se generan a partir de ahí. Ver Contexto.md §13 y `supabase/seed.sql` como referencia.

### Nota sobre los componentes de interfaz

Los componentes de `src/shared/ui` provienen de shadcn/ui en su estilo actual, que se apoya en **Base UI**. Base UI compone con la prop `render` en lugar de `asChild`:

```tsx
<DropdownMenuTrigger render={<Button variant="ghost" />}>Abrir</DropdownMenuTrigger>
```

Para enlaces con apariencia de botón usa el helper `EnlaceBoton` en vez de combinar `Button` con `Link`.

---

## Diseño

El producto es un **tablero de control oscuro**: fondo azul profundo con rejilla técnica y halos de color, paneles translúcidos y acentos neón. El tema oscuro es el modo por defecto (`defaultTheme="dark"`); el claro es su contraparte —mismos roles, mismas familias de color, pasos aclarados— y sigue disponible desde el selector de tema junto con «Sistema» (RNF-03).

Todo vive en `src/app/globals.css`: los tokens por tema y un puñado de clases que se reutilizan en lugar de repetir combinaciones de utilidades.

| Clase                     | Para qué                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.fondo-tablero`          | Fondo fijo de la aplicación: rejilla de 44 px y tres halos radiales.                                             |
| `.panel`                  | Superficie estándar: borde de un píxel, fondo translúcido y desenfoque. Sustituye a `rounded-lg border bg-card`. |
| `.panel-acento`           | Añade la línea de acento superior de los paneles de datos.                                                       |
| `.panel-enlace`           | Estado _hover_ de las tarjetas que son enlaces.                                                                  |
| `.etiqueta-dato`          | Versalitas espaciadas de las etiquetas de dato y de los títulos de sección.                                      |
| `.cifra` / `.cifra-heroe` | Cifra de un indicador / número protagonista de la vista (uno solo por pantalla).                                 |
| `.brillo-neon`            | Halo suave alrededor de un elemento destacado.                                                                   |

### Tipografía

Tres cortes, cada uno con un trabajo. Se cargan con `next/font/google` (subconjunto latino, `display: swap`) y las variables se declaran en `<html>`, no en `<body>`: la regla base `html { font-family: … }` vive por encima del body y no las vería.

| Rol            | Familia            | Dónde                                                                                    |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `font-sans`    | **Inter**          | Texto de interfaz, formularios, tablas y **todas las cifras**, incluida la protagonista. |
| `font-heading` | **Space Grotesk**  | `h1`–`h4` y títulos de tarjeta. Da el carácter técnico sin tocar los números.            |
| `font-mono`    | **JetBrains Mono** | Etiquetas de dato (`.etiqueta-dato`), cabeceras de tabla, insignias y marcas de eje.     |

Dos reglas que conviene no romper:

- **Las cifras van en Inter, nunca en el corte de titulares.** Un número grande en una tipografía de display se lee como decoración; en la sans de la interfaz se lee como dato. Por eso `.cifra` y `.cifra-heroe` fijan `font-sans` explícitamente.
- **`tabular-nums` solo en columnas** (filas de tabla, marcas de eje). En una cifra grande y aislada, los dígitos de ancho fijo se ven flojos: ahí van proporcionales.

En el tema anterior, `@theme inline { --font-sans: var(--font-sans) }` era autorreferencial, así que la variable quedaba inválida en `:root` y la tipografía no llegaba a aplicarse nunca. Los nombres del tema (`--font-*`) y los de `next/font` (`--fuente-*`) se mantienen separados justamente para eso.

### Gráficas

`src/shared/ui/viz` contiene las gráficas, todas en SVG y CSS —sin dependencias nuevas— y renderizadas en el servidor salvo `GraficoFlujo`, que necesita la capa de interacción:

- `MedidorAnillo` y `AnillosConcentricos`: una magnitud acotada y el reparto de un total.
- `MedidorLineal`: proporción sobre una pista del mismo tono.
- `BarrasComparativas`: columnas agrupadas, un solo eje de valores.
- `BarrasRanking`: barras horizontales ordenadas, con el valor en la punta.
- `GraficoFlujo`: ingresos y egresos mensuales con mira vertical y globo.
- `PanelGrafica` y `TablaDeDatos`: marco común (título y leyenda) y la tabla equivalente que acompaña a cada gráfica.

`DefinicionesGraficas` monta una vez por documento los degradados que usan las marcas; va en el layout privado.

### Paleta categórica

Orden fijo, asignado por serie y **nunca ciclado**: 1 verdemar (ingresos), 2 azul (egresos), 3 ámbar (inversión), 4 rosa, 5 violeta. Las tres primeras ranuras son las que se pueden usar cuando cualquier par de marcas puede quedar contiguo.

| Ranura | Claro     | Oscuro    |
| ------ | --------- | --------- |
| 1      | `#0a8e7c` | `#0aa791` |
| 2      | `#3560e0` | `#4f7ff5` |
| 3      | `#9a6a15` | `#c1841e` |
| 4      | `#c93a6d` | `#e04f85` |
| 5      | `#6b56d6` | `#8b78ee` |

Ambas columnas pasan las comprobaciones de banda de luminosidad, croma mínimo, separación bajo daltonismo (ΔE ≥ 8 en OKLab ×100), umbral de visión normal (ΔE ≥ 15) y contraste ≥ 3:1 contra su superficie. Si cambias un tono, vuelve a validarlo antes de subirlo; no se ajusta «a ojo».

El degradado de cada marca va del paso base a `--marca-realce` (blanco en oscuro, tinta en claro), así que el brillo nunca deja la marca por debajo del contraste ya validado.

---

## Despliegue

- **Aplicación:** Vercel. Configura las mismas variables de `.env.example` en el proyecto de Vercel; `TOKEN_ACCESO`, `SECRETO_SESION`, `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` como secretas.
- **Base de datos y archivos:** Supabase.
- Antes de cada despliegue, `npm run verify` debe pasar.
- Al desplegar en un dominio público, el token queda expuesto a intentos desde internet. Es el momento de que sea largo y aleatorio.
