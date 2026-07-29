-- ============================================================================
-- Gestor Financiero de Proyectos Personales — Esquema inicial
-- Referencia: Contexto.md §6.2 (enumerados) y §6.3 (esquema)
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

-- Perfil del usuario (extiende auth.users)
create table perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  moneda          char(3) not null default 'COP',
  zona_horaria    text    not null default 'America/Bogota',
  tema            text    not null default 'system' check (tema in ('light','dark','system')),
  preferencias    jsonb   not null default '{}'::jsonb,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table perfiles is 'Datos y preferencias del usuario; 1-1 con auth.users.';

-- Catalogo extensible de tipos de proyecto (sistema + personalizados). Contexto.md §13.
create table tipos_proyecto (
  id             uuid primary key default gen_random_uuid(),
  propietario_id uuid references perfiles(id) on delete cascade,   -- null = tipo del sistema
  codigo         text not null,
  nombre         text not null,
  icono          text,
  configuracion  jsonb not null default '{}'::jsonb,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  constraint tipos_proyecto_codigo_unico unique nulls not distinct (propietario_id, codigo)
);

comment on column tipos_proyecto.configuracion is
  'Declara atributos dinamicos e indicadores visibles: { "atributos": [...], "indicadores": [...], "genera_ingresos": bool, "se_valoriza": bool }. Permite nuevos tipos sin migracion (Contexto.md RNF-10).';

create table proyectos (
  id               uuid primary key default gen_random_uuid(),
  propietario_id   uuid not null references perfiles(id) on delete cascade,
  tipo_proyecto_id uuid not null references tipos_proyecto(id),
  nombre           text not null check (length(trim(nombre)) between 1 and 120),
  descripcion      text,
  fecha_inicio     date not null,
  fecha_fin        date,
  estado           estado_proyecto not null default 'activo',
  moneda           char(3) not null default 'COP',
  atributos        jsonb not null default '{}'::jsonb,
  creado_en        timestamptz not null default now(),
  creado_por       uuid not null references perfiles(id),
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id),
  constraint fechas_coherentes check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index proyectos_propietario_estado_idx on proyectos (propietario_id, estado);
create index proyectos_tipo_idx on proyectos (tipo_proyecto_id);

create table categorias (
  id               uuid primary key default gen_random_uuid(),
  propietario_id   uuid references perfiles(id) on delete cascade,   -- null = categoria del sistema
  tipo_proyecto_id uuid references tipos_proyecto(id),               -- null = aplica a todos
  padre_id         uuid references categorias(id) on delete cascade, -- null = categoria raiz
  nombre           text not null check (length(trim(nombre)) between 1 and 80),
  naturaleza       naturaleza_categoria not null,
  es_sistema       boolean not null default false,
  activa           boolean not null default true,
  orden            int not null default 0,
  creado_en        timestamptz not null default now()
);

create index categorias_busqueda_idx on categorias (propietario_id, tipo_proyecto_id, naturaleza);
create index categorias_padre_idx on categorias (padre_id);

-- Permite sembrar el catalogo del sistema de forma idempotente (seed.sql).
create unique index categorias_sistema_unicas_idx
  on categorias (tipo_proyecto_id, padre_id, nombre) nulls not distinct
  where propietario_id is null;

-- Evita categorias duplicadas por usuario.
create unique index categorias_usuario_unicas_idx
  on categorias (propietario_id, tipo_proyecto_id, padre_id, nombre) nulls not distinct
  where propietario_id is not null;

create table metodos_pago (
  id              uuid primary key default gen_random_uuid(),
  propietario_id  uuid not null references perfiles(id) on delete cascade,
  nombre          text not null check (length(trim(nombre)) between 1 and 60),
  tipo            text not null default 'otro'
    check (tipo in ('efectivo','transferencia','tarjeta_credito','tarjeta_debito','debito_automatico','otro')),
  ultimos_digitos text check (ultimos_digitos ~ '^[0-9]{2,4}$'),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  constraint metodos_pago_nombre_unico unique (propietario_id, nombre)
);

create table movimientos (
  id                uuid primary key default gen_random_uuid(),
  propietario_id    uuid not null references perfiles(id) on delete cascade,
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
  creado_por        uuid not null references perfiles(id),
  actualizado_en    timestamptz not null default now(),
  actualizado_por   uuid references perfiles(id),
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
create index movimientos_vencimiento_idx on movimientos (propietario_id, estado, fecha_vencimiento);
create index movimientos_categoria_idx on movimientos (categoria_id);
create index movimientos_propietario_fecha_idx on movimientos (propietario_id, fecha desc);
create index movimientos_descripcion_idx on movimientos using gin (to_tsvector('spanish', descripcion));

create table obligaciones (
  id                    uuid primary key default gen_random_uuid(),
  propietario_id        uuid not null references perfiles(id) on delete cascade,
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
  creado_por            uuid not null references perfiles(id),
  actualizado_en        timestamptz not null default now(),
  actualizado_por       uuid references perfiles(id),
  constraint intervalo_personalizado check (frecuencia <> 'personalizada' or intervalo_meses is not null)
);

create index obligaciones_activas_idx on obligaciones (propietario_id, activa);
create index obligaciones_proyecto_idx on obligaciones (proyecto_id);

create table ocurrencias_obligacion (
  id                uuid primary key default gen_random_uuid(),
  obligacion_id     uuid not null references obligaciones(id) on delete cascade,
  propietario_id    uuid not null references perfiles(id) on delete cascade,
  fecha_vencimiento date not null,
  valor_estimado    numeric(18,2) not null check (valor_estimado >= 0),
  estado            estado_ocurrencia not null default 'pendiente',
  movimiento_id     uuid references movimientos(id) on delete set null,
  creado_en         timestamptz not null default now(),
  -- Idempotencia de la tarea diaria (§5.6, §10.1)
  constraint ocurrencia_unica unique (obligacion_id, fecha_vencimiento)
);

create index ocurrencias_agenda_idx on ocurrencias_obligacion (propietario_id, estado, fecha_vencimiento);

alter table movimientos
  add constraint movimientos_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias_obligacion(id) on delete set null;

create table documentos (
  id             uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references perfiles(id) on delete cascade,
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  movimiento_id  uuid references movimientos(id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage   text not null unique,
  tipo_documento tipo_documento not null default 'otro',
  mime_type      text not null,
  tamano_bytes   bigint not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  cargado_por    uuid not null references perfiles(id),
  cargado_en     timestamptz not null default now(),
  eliminado_en   timestamptz
);

comment on column documentos.ruta_storage is
  'Convencion: {propietario_id}/{proyecto_id}/{uuid}-{slug}. El primer segmento debe ser auth.uid() (§6.7).';

create index documentos_proyecto_idx on documentos (proyecto_id) where eliminado_en is null;
create index documentos_movimiento_idx on documentos (movimiento_id) where eliminado_en is null;

create table pasivos (
  id               uuid primary key default gen_random_uuid(),
  propietario_id   uuid not null references perfiles(id) on delete cascade,
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
  id             uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references perfiles(id) on delete cascade,
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  fecha          date not null,
  valor          numeric(18,2) not null check (valor >= 0),
  fuente         text,
  notas          text,
  creado_en      timestamptz not null default now(),
  constraint valoracion_unica unique (proyecto_id, fecha)
);

create table presupuestos (
  id             uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references perfiles(id) on delete cascade,
  proyecto_id    uuid references proyectos(id) on delete cascade,   -- null = presupuesto global
  categoria_id   uuid not null references categorias(id),
  periodo_inicio date not null,
  periodo_fin    date not null,
  valor_planeado numeric(18,2) not null check (valor_planeado >= 0),
  notas          text,
  creado_en      timestamptz not null default now(),
  constraint periodo_valido check (periodo_fin >= periodo_inicio),
  constraint presupuesto_unico unique nulls not distinct
    (propietario_id, proyecto_id, categoria_id, periodo_inicio, periodo_fin)
);

create table notificaciones (
  id              uuid primary key default gen_random_uuid(),
  propietario_id  uuid not null references perfiles(id) on delete cascade,
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

create table registro_auditoria (
  id             bigserial primary key,
  propietario_id uuid not null references perfiles(id) on delete cascade,
  entidad        text not null,
  entidad_id     uuid not null,
  accion         text not null check (accion in ('crear','actualizar','anular','eliminar')),
  cambios        jsonb,
  actor_id       uuid not null,
  ocurrido_en    timestamptz not null default now()
);

create index auditoria_entidad_idx on registro_auditoria (entidad, entidad_id, ocurrido_en desc);
create index auditoria_propietario_idx on registro_auditoria (propietario_id, ocurrido_en desc);
