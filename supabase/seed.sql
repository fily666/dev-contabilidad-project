-- ============================================================================
-- Datos semilla del sistema — Contexto.md §6.8
-- Idempotente: puede ejecutarse varias veces sin duplicar.
--   0. Fila unica de ajustes
--   1. Tipos de proyecto del sistema, con sus atributos e indicadores (§13)
--   2. Catalogo de categorias del sistema, con su naturaleza (§2, RF-32)
--   3. Metodos de pago iniciales (RF-33)
-- ============================================================================

-- El trigger proteger_filas_de_sistema bloquea cualquier update sobre las filas
-- sembradas. Este ajuste declara que lo que sigue ES el sembrado, y es la unica
-- via legitima para volver a escribirlas.
set app.sembrando = 'on';

-- ─── 0. Ajustes de la instalacion ───────────────────────────────────────────

-- `preferencias` guarda RF-101 (formato de fecha y horizonte de proyeccion) en
-- lugar de columnas propias: son preferencias de presentacion, y agregar una mas
-- no debe costar una migracion. La aplicacion tolera claves ausentes.
insert into ajustes (id, moneda, zona_horaria, preferencias)
values (
  true, 'COP', 'America/Bogota',
  '{"formato_fecha": "d MMM yyyy", "horizonte_proyeccion_meses": 12, "canales_notificacion": ["in_app"], "dias_aviso_por_omision": [5, 1], "email_destino": null}'::jsonb
)
on conflict (id) do nothing;

-- ─── 1. Tipos de proyecto ───────────────────────────────────────────────────

insert into tipos_proyecto (codigo, nombre, icono, es_sistema, configuracion) values
(
  'inmueble', 'Inmueble', 'building-2', true,
  '{
    "atributos": [
      { "clave": "direccion",   "etiqueta": "Dirección",              "tipo": "text",   "requerido": true },
      { "clave": "ciudad",      "etiqueta": "Ciudad",                 "tipo": "text",   "requerido": false },
      { "clave": "matricula",   "etiqueta": "Matrícula inmobiliaria", "tipo": "text",   "requerido": false },
      { "clave": "area_m2",     "etiqueta": "Área (m²)",              "tipo": "number", "requerido": false },
      { "clave": "estrato",     "etiqueta": "Estrato",                "tipo": "number", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_ingresos","total_egresos","balance","yield_neto","cap_rate","roi_acumulado","payback","plusvalia"],
    "genera_ingresos": true,
    "se_valoriza": true
  }'::jsonb
),
(
  'vehiculo', 'Vehículo', 'car', true,
  '{
    "atributos": [
      { "clave": "placa",      "etiqueta": "Placa",       "tipo": "text",   "requerido": true },
      { "clave": "marca",      "etiqueta": "Marca",       "tipo": "text",   "requerido": true },
      { "clave": "linea",      "etiqueta": "Línea",       "tipo": "text",   "requerido": false },
      { "clave": "modelo",     "etiqueta": "Modelo (año)","tipo": "number", "requerido": false },
      { "clave": "cilindraje", "etiqueta": "Cilindraje",  "tipo": "number", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_egresos","tco","costo_mensual","plusvalia"],
    "genera_ingresos": false,
    "se_valoriza": true
  }'::jsonb
),
(
  'negocio', 'Negocio', 'store', true,
  '{
    "atributos": [
      { "clave": "razon_social", "etiqueta": "Razón social", "tipo": "text", "requerido": false },
      { "clave": "nit",          "etiqueta": "NIT",          "tipo": "text", "requerido": false },
      { "clave": "sector",       "etiqueta": "Sector",       "tipo": "text", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_ingresos","total_egresos","balance","roi_acumulado","payback"],
    "genera_ingresos": true,
    "se_valoriza": false
  }'::jsonb
),
(
  'inversion', 'Inversión', 'trending-up', true,
  '{
    "atributos": [
      { "clave": "instrumento", "etiqueta": "Instrumento", "tipo": "text", "requerido": false },
      { "clave": "entidad",     "etiqueta": "Entidad",     "tipo": "text", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_ingresos","balance","yield_bruto","roi_acumulado","plusvalia"],
    "genera_ingresos": true,
    "se_valoriza": true
  }'::jsonb
),
(
  'construccion', 'Construcción de vivienda', 'hard-hat', true,
  '{
    "atributos": [
      { "clave": "direccion",        "etiqueta": "Dirección del lote",     "tipo": "text",   "requerido": true },
      { "clave": "area_lote_m2",     "etiqueta": "Área del lote (m²)",     "tipo": "number", "requerido": false },
      { "clave": "area_construida",  "etiqueta": "Área construida (m²)",   "tipo": "number", "requerido": false },
      { "clave": "licencia",         "etiqueta": "Licencia de construcción","tipo": "text",  "requerido": false },
      { "clave": "fecha_entrega",    "etiqueta": "Entrega estimada",       "tipo": "date",   "requerido": false }
    ],
    "indicadores": ["total_invertido","total_egresos","balance","capital_aportado","costo_mensual","plusvalia","patrimonio_neto"],
    "genera_ingresos": false,
    "se_valoriza": true
  }'::jsonb
),
(
  'cripto', 'Criptomonedas', 'bitcoin', true,
  '{
    "atributos": [
      { "clave": "activo",     "etiqueta": "Activo",           "tipo": "text", "requerido": true },
      { "clave": "exchange",   "etiqueta": "Exchange o wallet", "tipo": "text", "requerido": false },
      { "clave": "red",        "etiqueta": "Red",               "tipo": "text", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_ingresos","balance","roi_acumulado","plusvalia","retorno_total"],
    "genera_ingresos": true,
    "se_valoriza": true
  }'::jsonb
),
(
  'viaje', 'Viaje', 'plane', true,
  '{
    "atributos": [
      { "clave": "destino",       "etiqueta": "Destino",        "tipo": "text",   "requerido": true },
      { "clave": "fecha_salida",  "etiqueta": "Fecha de salida","tipo": "date",   "requerido": false },
      { "clave": "viajeros",      "etiqueta": "Viajeros",       "tipo": "number", "requerido": false }
    ],
    "indicadores": ["total_egresos","tco","costo_mensual","balance"],
    "genera_ingresos": false,
    "se_valoriza": false
  }'::jsonb
),
(
  'otro', 'Otro', 'folder', true,
  '{
    "atributos": [],
    "indicadores": ["total_invertido","total_ingresos","total_egresos","balance","costo_mensual"],
    "genera_ingresos": true,
    "se_valoriza": false
  }'::jsonb
)
on conflict (codigo) do update
  set nombre        = excluded.nombre,
      icono         = excluded.icono,
      configuracion = excluded.configuracion;

-- ─── 2. Catalogo de categorias del sistema ──────────────────────────────────

create or replace function pg_temp.sembrar_categoria(
  p_tipo_codigo text,
  p_padre       text,
  p_nombre      text,
  p_naturaleza  naturaleza_categoria,
  p_orden       int
) returns void
language plpgsql
as $$
declare
  v_tipo_id  uuid;
  v_padre_id uuid;
begin
  if p_tipo_codigo is not null then
    select id into v_tipo_id from tipos_proyecto where codigo = p_tipo_codigo;
  end if;

  if p_padre is not null then
    select id into v_padre_id from categorias
     where nombre = p_padre
       and tipo_proyecto_id is not distinct from v_tipo_id
       and padre_id is null;
    if v_padre_id is null then
      raise exception 'Categoria padre "%" no encontrada para el tipo "%"', p_padre, p_tipo_codigo;
    end if;
  end if;

  insert into categorias (tipo_proyecto_id, padre_id, nombre, naturaleza, es_sistema, orden)
  values (v_tipo_id, v_padre_id, p_nombre, p_naturaleza, true, p_orden)
  on conflict (tipo_proyecto_id, padre_id, nombre)
  do update set naturaleza = excluded.naturaleza, orden = excluded.orden;
end;
$$;

-- 2.1 Transversales (aplican a todos los tipos de proyecto)
select pg_temp.sembrar_categoria(null, null, 'Financiación',                    'financiacion', 90);
select pg_temp.sembrar_categoria(null, 'Financiación', 'Desembolso de crédito', 'financiacion', 1);
select pg_temp.sembrar_categoria(null, 'Financiación', 'Cuota de crédito',      'financiacion', 2);
select pg_temp.sembrar_categoria(null, 'Financiación', 'Abono extraordinario a capital', 'financiacion', 3);
select pg_temp.sembrar_categoria(null, null, 'Otros ingresos',                  'ingreso', 95);
select pg_temp.sembrar_categoria(null, null, 'Otros egresos',                   'opex',    96);

-- 2.2 Inmueble (§3.1)
select pg_temp.sembrar_categoria('inmueble', null, 'Adquisición', 'capex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Adquisición', 'Separación',            'capex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Adquisición', 'Cuota inicial',         'capex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Adquisición', 'Gastos notariales',     'capex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Adquisición', 'Escrituración',         'capex', 4);
select pg_temp.sembrar_categoria('inmueble', 'Adquisición', 'Impuesto de registro',  'capex', 5);
select pg_temp.sembrar_categoria('inmueble', 'Adquisición', 'Comisión inmobiliaria', 'capex', 6);

select pg_temp.sembrar_categoria('inmueble', null, 'Mejoras y adecuaciones', 'capex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Remodelación',            'capex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Muebles',                 'capex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Electrodomésticos',       'capex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Otras adecuaciones',      'capex', 4);

select pg_temp.sembrar_categoria('inmueble', null, 'Sostenimiento', 'opex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Administración',        'opex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Servicios públicos',    'opex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Cuotas extraordinarias','opex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Reparaciones',          'opex', 4);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Aseo y mantenimiento',  'opex', 5);

select pg_temp.sembrar_categoria('inmueble', null, 'Impuestos y seguros', 'opex', 4);
select pg_temp.sembrar_categoria('inmueble', 'Impuestos y seguros', 'Impuesto predial', 'opex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Impuestos y seguros', 'Seguro de hogar',  'opex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Impuestos y seguros', 'Otros seguros',    'opex', 3);

select pg_temp.sembrar_categoria('inmueble', null, 'Arrendamiento', 'ingreso', 5);
select pg_temp.sembrar_categoria('inmueble', 'Arrendamiento', 'Canon de arrendamiento', 'ingreso', 1);
select pg_temp.sembrar_categoria('inmueble', 'Arrendamiento', 'Reajuste de canon',      'ingreso', 2);
select pg_temp.sembrar_categoria('inmueble', 'Arrendamiento', 'Reembolsos del inquilino','ingreso', 3);

-- 2.3 Vehiculo (§3.2)
select pg_temp.sembrar_categoria('vehiculo', null, 'Adquisición', 'capex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisición', 'Valor de compra', 'capex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisición', 'Matrícula',       'capex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisición', 'Accesorios',      'capex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisición', 'Traspaso',        'capex', 4);

select pg_temp.sembrar_categoria('vehiculo', null, 'Mantenimiento', 'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Mantenimiento preventivo', 'opex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Cambio de aceite',         'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Cambio de llantas',        'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Frenos',                   'opex', 4);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Reparaciones',             'opex', 5);

select pg_temp.sembrar_categoria('vehiculo', null, 'Documentos e impuestos', 'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'SOAT',                     'opex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Revisión tecnicomecánica', 'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Impuesto vehicular',       'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Renovación de documentos', 'opex', 4);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Comparendos',              'opex', 5);

select pg_temp.sembrar_categoria('vehiculo', null, 'Operación', 'opex', 4);
select pg_temp.sembrar_categoria('vehiculo', 'Operación', 'Combustible',  'opex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Operación', 'Parqueadero',  'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Operación', 'Peajes',       'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Operación', 'Lavado',       'opex', 4);

select pg_temp.sembrar_categoria('vehiculo', null, 'Seguros', 'opex', 5);
select pg_temp.sembrar_categoria('vehiculo', 'Seguros', 'Seguro todo riesgo', 'opex', 1);

-- 2.4 Negocio
select pg_temp.sembrar_categoria('negocio', null, 'Inversión inicial', 'capex', 1);
select pg_temp.sembrar_categoria('negocio', 'Inversión inicial', 'Constitución legal',  'capex', 1);
select pg_temp.sembrar_categoria('negocio', 'Inversión inicial', 'Equipos',             'capex', 2);
select pg_temp.sembrar_categoria('negocio', 'Inversión inicial', 'Adecuación de local', 'capex', 3);
select pg_temp.sembrar_categoria('negocio', 'Inversión inicial', 'Inventario inicial',  'capex', 4);

select pg_temp.sembrar_categoria('negocio', null, 'Operación', 'opex', 2);
select pg_temp.sembrar_categoria('negocio', 'Operación', 'Arriendo',    'opex', 1);
select pg_temp.sembrar_categoria('negocio', 'Operación', 'Nómina',      'opex', 2);
select pg_temp.sembrar_categoria('negocio', 'Operación', 'Servicios',   'opex', 3);
select pg_temp.sembrar_categoria('negocio', 'Operación', 'Insumos',     'opex', 4);
select pg_temp.sembrar_categoria('negocio', 'Operación', 'Publicidad',  'opex', 5);
select pg_temp.sembrar_categoria('negocio', 'Operación', 'Impuestos',   'opex', 6);

select pg_temp.sembrar_categoria('negocio', null, 'Ventas', 'ingreso', 3);
select pg_temp.sembrar_categoria('negocio', 'Ventas', 'Venta de productos', 'ingreso', 1);
select pg_temp.sembrar_categoria('negocio', 'Ventas', 'Venta de servicios', 'ingreso', 2);

-- 2.5 Inversion
select pg_temp.sembrar_categoria('inversion', null, 'Aportes', 'capex', 1);
select pg_temp.sembrar_categoria('inversion', 'Aportes', 'Aporte de capital', 'capex', 1);
select pg_temp.sembrar_categoria('inversion', 'Aportes', 'Compra de activo',  'capex', 2);

select pg_temp.sembrar_categoria('inversion', null, 'Costos', 'opex', 2);
select pg_temp.sembrar_categoria('inversion', 'Costos', 'Comisiones',   'opex', 1);
select pg_temp.sembrar_categoria('inversion', 'Costos', 'Custodia',     'opex', 2);
select pg_temp.sembrar_categoria('inversion', 'Costos', 'Impuestos',    'opex', 3);

select pg_temp.sembrar_categoria('inversion', null, 'Rendimientos', 'ingreso', 3);
select pg_temp.sembrar_categoria('inversion', 'Rendimientos', 'Dividendos',            'ingreso', 1);
select pg_temp.sembrar_categoria('inversion', 'Rendimientos', 'Intereses',             'ingreso', 2);
select pg_temp.sembrar_categoria('inversion', 'Rendimientos', 'Valorización realizada','ingreso', 3);
select pg_temp.sembrar_categoria('inversion', 'Rendimientos', 'Retiro de capital',     'ingreso', 4);

-- 2.6 Construccion de vivienda (Fase 5)
select pg_temp.sembrar_categoria('construccion', null, 'Terreno',        'capex', 1);
select pg_temp.sembrar_categoria('construccion', 'Terreno', 'Compra del lote',       'capex', 1);
select pg_temp.sembrar_categoria('construccion', 'Terreno', 'Estudios y licencias',  'capex', 2);
select pg_temp.sembrar_categoria('construccion', null, 'Obra',           'capex', 2);
select pg_temp.sembrar_categoria('construccion', 'Obra', 'Materiales',              'capex', 1);
select pg_temp.sembrar_categoria('construccion', 'Obra', 'Mano de obra',            'capex', 2);
select pg_temp.sembrar_categoria('construccion', 'Obra', 'Diseño y honorarios',     'capex', 3);
select pg_temp.sembrar_categoria('construccion', 'Obra', 'Acabados',                'capex', 4);
select pg_temp.sembrar_categoria('construccion', null, 'Servicios de obra', 'opex', 3);
select pg_temp.sembrar_categoria('construccion', 'Servicios de obra', 'Servicios públicos', 'opex', 1);
select pg_temp.sembrar_categoria('construccion', 'Servicios de obra', 'Vigilancia',         'opex', 2);
select pg_temp.sembrar_categoria('construccion', 'Servicios de obra', 'Impuestos y tasas',  'opex', 3);

-- 2.7 Criptomonedas (Fase 5)
select pg_temp.sembrar_categoria('cripto', null, 'Compras',      'capex', 1);
select pg_temp.sembrar_categoria('cripto', null, 'Costos',       'opex', 2);
select pg_temp.sembrar_categoria('cripto', 'Costos', 'Comisiones de transacción', 'opex', 1);
select pg_temp.sembrar_categoria('cripto', 'Costos', 'Retiros y redes',           'opex', 2);
select pg_temp.sembrar_categoria('cripto', null, 'Rendimientos', 'ingreso', 3);
select pg_temp.sembrar_categoria('cripto', 'Rendimientos', 'Staking',            'ingreso', 1);
select pg_temp.sembrar_categoria('cripto', 'Rendimientos', 'Venta realizada',    'ingreso', 2);

-- 2.8 Viaje (Fase 5)
select pg_temp.sembrar_categoria('viaje', null, 'Transporte',  'opex', 1);
select pg_temp.sembrar_categoria('viaje', 'Transporte', 'Tiquetes',        'opex', 1);
select pg_temp.sembrar_categoria('viaje', 'Transporte', 'Traslados',       'opex', 2);
select pg_temp.sembrar_categoria('viaje', null, 'Alojamiento', 'opex', 2);
select pg_temp.sembrar_categoria('viaje', null, 'Alimentación', 'opex', 3);
select pg_temp.sembrar_categoria('viaje', null, 'Actividades',  'opex', 4);
select pg_temp.sembrar_categoria('viaje', null, 'Seguros y visados', 'opex', 5);

-- ─── 3. Metodos de pago iniciales (RF-33) ───────────────────────────────────
-- Antes los creaba el trigger de alta de usuario; sin usuarios, se siembran aqui.

insert into metodos_pago (nombre, tipo) values
  ('Efectivo',           'efectivo'),
  ('Transferencia',      'transferencia'),
  ('Tarjeta de credito', 'tarjeta_credito'),
  ('Debito automatico',  'debito_automatico')
on conflict (nombre) do nothing;

reset app.sembrando;
