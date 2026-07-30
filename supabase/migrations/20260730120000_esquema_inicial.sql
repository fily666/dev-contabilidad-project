-- ============================================================================
-- Gestor Financiero de Proyectos Personales — Esquema inicial
-- Referencia: Contexto.md §6.2 (enumerados) y §6.3 (esquema)
--
-- SISTEMA MONOUSUARIO (ADR-14): no hay tabla de usuarios ni columna de
-- propietario. Toda la informacion de la base pertenece al unico dueno, que
-- entra con el token de TOKEN_ACCESO. La base no conoce identidades: el
-- control de acceso vive en la aplicacion (§9) y el blindaje de la base
-- consiste en que ningun rol publico tiene permisos (migracion 20260730120300).
-- ============================================================================

-- gen_random_uuid() es parte del nucleo de PostgreSQL desde la version 13.

-- ─── §6.2 Tipos enumerados ──────────────────────────────────────────────────

create type estado_proyecto      as enum ('activo','pausado','finalizado','archivado');
create type tipo_movimiento      as enum ('ingreso','egreso');
create type naturaleza_categoria as enum ('capex','opex','ingreso','financiacion');
create type estado_movimiento    as enum ('pendiente','pagado','vencido','anulado');
create type frecuencia           as enum ('unica','mensual','bimestral','trimestral','semestral','anual','personalizada');
create type estado_ocurrencia    as enum ('pendiente','pagada','vencida','omitida');
create type tipo_documento       as enum ('factura','recibo','comprobante','contrato','escritura','fotografia','poliza','otro');
create type tipo_pasivo          as enum ('credito_hipotecario','credito_vehiculo','credito_libre','tarjeta_credito','otro');
create type canal_notificacion   as enum ('email','whatsapp','in_app');
create type estado_notificacion  as enum ('programada','enviada','fallida','cancelada');

-- ─── §6.3 Esquema ───────────────────────────────────────────────────────────

-- Preferencias de la aplicacion. Sustituye a la antigua tabla de perfiles: no
-- describe a una persona, configura la instalacion. El truco de la clave
-- primaria booleana con check garantiza que exista a lo sumo una fila.
create table ajustes (
  id             boolean primary key default true check (id),
  moneda         char(3) not null default 'COP',
  zona_horaria   text    not null default 'America/Bogota',
  preferencias   jsonb   not null default '{}'::jsonb,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table ajustes is
  'Fila unica con las preferencias de la instalacion (moneda y zona horaria de negocio). El check sobre la PK booleana impide una segunda fila.';

-- Catalogo extensible de tipos de proyecto (sistema + propios). Contexto.md §13.
create table tipos_proyecto (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  nombre        text not null,
  icono         text,
  configuracion jsonb not null default '{}'::jsonb,
  es_sistema    boolean not null default false,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

comment on column tipos_proyecto.configuracion is
  'Declara atributos dinamicos e indicadores visibles: { "atributos": [...], "indicadores": [...], "genera_ingresos": bool, "se_valoriza": bool }. Permite nuevos tipos sin migracion (Contexto.md RNF-10).';

comment on column tipos_proyecto.es_sistema is
  'true = viene de seed.sql y no se puede modificar ni borrar (trigger proteger_filas_de_sistema). Antes esta distincion era "propietario_id is null".';

create table proyectos (
  id               uuid primary key default gen_random_uuid(),
  tipo_proyecto_id uuid not null references tipos_proyecto(id),
  nombre           text not null check (length(trim(nombre)) between 1 and 120),
  descripcion      text,
  fecha_inicio     date not null,
  fecha_fin        date,
  estado           estado_proyecto not null default 'activo',
  moneda           char(3) not null default 'COP',
  atributos        jsonb not null default '{}'::jsonb,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint fechas_coherentes check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index proyectos_estado_idx on proyectos (estado);
create index proyectos_tipo_idx on proyectos (tipo_proyecto_id);

create table categorias (
  id               uuid primary key default gen_random_uuid(),
  tipo_proyecto_id uuid references tipos_proyecto(id),               -- null = aplica a todos
  padre_id         uuid references categorias(id) on delete cascade, -- null = categoria raiz
  nombre           text not null check (length(trim(nombre)) between 1 and 80),
  naturaleza       naturaleza_categoria not null,
  es_sistema       boolean not null default false,
  activa           boolean not null default true,
  orden            int not null default 0,
  creado_en        timestamptz not null default now()
);

create index categorias_busqueda_idx on categorias (tipo_proyecto_id, naturaleza);
create index categorias_padre_idx on categorias (padre_id);

-- Un solo indice para todo el catalogo: sin propietario, sistema y propias
-- comparten espacio de nombres. `nulls not distinct` hace que las raices
-- (padre_id null) y las transversales (tipo_proyecto_id null) tambien colisionen,
-- lo que permite sembrar de forma idempotente (seed.sql).
create unique index categorias_unicas_idx
  on categorias (tipo_proyecto_id, padre_id, nombre) nulls not distinct;

create table metodos_pago (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(trim(nombre)) between 1 and 60),
  tipo            text not null default 'otro'
    check (tipo in ('efectivo','transferencia','tarjeta_credito','tarjeta_debito','debito_automatico','otro')),
  ultimos_digitos text check (ultimos_digitos ~ '^[0-9]{2,4}$'),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  constraint metodos_pago_nombre_unico unique (nombre)
);

create table movimientos (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid not null references proyectos(id) on delete restrict,
  categoria_id      uuid not null references categorias(id),
  metodo_pago_id    uuid references metodos_pago(id),
  tipo              tipo_movimiento not null,
  naturaleza        naturaleza_categoria not null,
  fecha             date not null,
  fecha_vencimiento date,
  fecha_pago        date,
  valor             numeric(18,2) not null check (valor > 0),
  moneda            char(3) not null default 'COP',
  abono_capital     numeric(18,2) check (abono_capital >= 0),
  abono_interes     numeric(18,2) check (abono_interes >= 0),
  descripcion       text not null check (length(trim(descripcion)) between 1 and 200),
  observaciones     text,
  estado            estado_movimiento not null default 'pendiente',
  motivo_anulacion  text,
  ocurrencia_id     uuid,
  metadatos         jsonb not null default '{}'::jsonb,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint pagado_requiere_fecha check (estado <> 'pagado' or fecha_pago is not null),
  constraint anulado_requiere_motivo check (estado <> 'anulado' or motivo_anulacion is not null),
  constraint desglose_credito check (
    (abono_capital is null and abono_interes is null)
    or (abono_capital is not null and abono_interes is not null and abono_capital + abono_interes = valor)
  ),
  -- Invariante §5.7.3: la naturaleza 'ingreso' solo aplica a movimientos de tipo ingreso.
  constraint naturaleza_coherente check (
    (tipo = 'ingreso' and naturaleza in ('ingreso','financiacion'))
    or (tipo = 'egreso' and naturaleza in ('capex','opex','financiacion'))
  )
);

comment on column movimientos.naturaleza is
  'capex = inversion que capitaliza, opex = gasto operativo, financiacion = deuda, ingreso = entrada. Se propone desde la categoria y es sobreescribible (RF-21).';

create index movimientos_proyecto_fecha_idx on movimientos (proyecto_id, fecha desc);
create index movimientos_vencimiento_idx on movimientos (estado, fecha_vencimiento);
create index movimientos_categoria_idx on movimientos (categoria_id);
create index movimientos_fecha_idx on movimientos (fecha desc);
create index movimientos_descripcion_idx on movimientos using gin (to_tsvector('spanish', descripcion));

create table obligaciones (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references proyectos(id) on delete cascade,
  categoria_id          uuid not null references categorias(id),
  concepto              text not null check (length(trim(concepto)) between 1 and 150),
  valor_estimado        numeric(18,2) not null check (valor_estimado >= 0),
  fecha_vencimiento     date not null,
  frecuencia            frecuencia not null,
  intervalo_meses       int check (intervalo_meses > 0),
  dias_aviso            int[] not null default '{5,1}',
  crear_movimiento_auto boolean not null default false,
  activa                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  constraint intervalo_personalizado check (frecuencia <> 'personalizada' or intervalo_meses is not null)
);

create index obligaciones_activas_idx on obligaciones (activa);
create index obligaciones_proyecto_idx on obligaciones (proyecto_id);

create table ocurrencias_obligacion (
  id                uuid primary key default gen_random_uuid(),
  obligacion_id     uuid not null references obligaciones(id) on delete cascade,
  fecha_vencimiento date not null,
  valor_estimado    numeric(18,2) not null check (valor_estimado >= 0),
  estado            estado_ocurrencia not null default 'pendiente',
  movimiento_id     uuid references movimientos(id) on delete set null,
  creado_en         timestamptz not null default now(),
  -- Idempotencia de la tarea diaria (§5.6, §10.1)
  constraint ocurrencia_unica unique (obligacion_id, fecha_vencimiento)
);

create index ocurrencias_agenda_idx on ocurrencias_obligacion (estado, fecha_vencimiento);

alter table movimientos
  add constraint movimientos_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias_obligacion(id) on delete set null;

create table documentos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  movimiento_id  uuid references movimientos(id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage   text not null unique,
  tipo_documento tipo_documento not null default 'otro',
  mime_type      text not null,
  tamano_bytes   bigint not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  cargado_en     timestamptz not null default now(),
  eliminado_en   timestamptz
);

comment on column documentos.ruta_storage is
  'Convencion: {proyecto_id}/{uuid}-{slug}. El bucket es privado y no tiene politicas: solo se accede por URL firmada generada en el servidor (§6.7).';

create index documentos_proyecto_idx on documentos (proyecto_id) where eliminado_en is null;
create index documentos_movimiento_idx on documentos (movimiento_id) where eliminado_en is null;

create table pasivos (
  id               uuid primary key default gen_random_uuid(),
  proyecto_id      uuid not null references proyectos(id) on delete cascade,
  nombre           text not null,
  tipo             tipo_pasivo not null,
  monto_original   numeric(18,2) not null check (monto_original > 0),
  saldo_actual     numeric(18,2) not null check (saldo_actual >= 0),
  tasa_interes_ea  numeric(6,4) check (tasa_interes_ea >= 0),
  plazo_meses      int check (plazo_meses > 0),
  valor_cuota      numeric(18,2) check (valor_cuota > 0),
  fecha_desembolso date not null,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create index pasivos_proyecto_idx on pasivos (proyecto_id) where activo;

create table valoraciones (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  fecha       date not null,
  valor       numeric(18,2) not null check (valor >= 0),
  fuente      text,
  notas       text,
  creado_en   timestamptz not null default now(),
  constraint valoracion_unica unique (proyecto_id, fecha)
);

create table presupuestos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid references proyectos(id) on delete cascade,   -- null = presupuesto global
  categoria_id   uuid not null references categorias(id),
  periodo_inicio date not null,
  periodo_fin    date not null,
  valor_planeado numeric(18,2) not null check (valor_planeado >= 0),
  notas          text,
  creado_en      timestamptz not null default now(),
  constraint periodo_valido check (periodo_fin >= periodo_inicio),
  constraint presupuesto_unico unique nulls not distinct
    (proyecto_id, categoria_id, periodo_inicio, periodo_fin)
);

create table notificaciones (
  id              uuid primary key default gen_random_uuid(),
  ocurrencia_id   uuid references ocurrencias_obligacion(id) on delete cascade,
  canal           canal_notificacion not null,
  asunto          text not null,
  cuerpo          text not null,
  programada_para timestamptz not null,
  enviada_en      timestamptz,
  estado          estado_notificacion not null default 'programada',
  error           text,
  intentos        int not null default 0 check (intentos >= 0)
);

create index notificaciones_cola_idx on notificaciones (estado, programada_para);
-- Idempotencia del job de notificaciones (§10.1)
create unique index notificaciones_unicas_idx
  on notificaciones (ocurrencia_id, canal, programada_para)
  where ocurrencia_id is not null;

-- Rastro de cambios. Sin actor: el sistema tiene un solo operador, asi que la
-- pregunta que responde es "que cambio y cuando", no "quien lo cambio".
create table registro_auditoria (
  id          bigserial primary key,
  entidad     text not null,
  entidad_id  uuid not null,
  accion      text not null check (accion in ('crear','actualizar','anular','eliminar')),
  cambios     jsonb,
  ocurrido_en timestamptz not null default now()
);

create index auditoria_entidad_idx on registro_auditoria (entidad, entidad_id, ocurrido_en desc);
create index auditoria_reciente_idx on registro_auditoria (ocurrido_en desc);
