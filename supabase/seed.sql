-- ============================================================================
-- Datos semilla del sistema — Contexto.md §6.8
-- Idempotente: puede ejecutarse varias veces sin duplicar.
--   1. Tipos de proyecto del sistema, con sus atributos e indicadores (§13)
--   2. Catalogo de categorias del sistema, con su naturaleza (§2, RF-32)
-- ============================================================================

-- ─── 1. Tipos de proyecto ───────────────────────────────────────────────────

insert into tipos_proyecto (propietario_id, codigo, nombre, icono, configuracion) values
(
  null, 'inmueble', 'Inmueble', 'building-2',
  '{
    "atributos": [
      { "clave": "direccion",   "etiqueta": "Direccion",              "tipo": "text",   "requerido": true },
      { "clave": "ciudad",      "etiqueta": "Ciudad",                 "tipo": "text",   "requerido": false },
      { "clave": "matricula",   "etiqueta": "Matricula inmobiliaria", "tipo": "text",   "requerido": false },
      { "clave": "area_m2",     "etiqueta": "Area (m2)",              "tipo": "number", "requerido": false },
      { "clave": "estrato",     "etiqueta": "Estrato",                "tipo": "number", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_ingresos","total_egresos","balance","yield_neto","cap_rate","roi_acumulado","payback","plusvalia"],
    "genera_ingresos": true,
    "se_valoriza": true
  }'::jsonb
),
(
  null, 'vehiculo', 'Vehiculo', 'car',
  '{
    "atributos": [
      { "clave": "placa",      "etiqueta": "Placa",       "tipo": "text",   "requerido": true },
      { "clave": "marca",      "etiqueta": "Marca",       "tipo": "text",   "requerido": true },
      { "clave": "linea",      "etiqueta": "Linea",       "tipo": "text",   "requerido": false },
      { "clave": "modelo",     "etiqueta": "Modelo (ano)","tipo": "number", "requerido": false },
      { "clave": "cilindraje", "etiqueta": "Cilindraje",  "tipo": "number", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_egresos","tco","costo_mensual","plusvalia"],
    "genera_ingresos": false,
    "se_valoriza": true
  }'::jsonb
),
(
  null, 'negocio', 'Negocio', 'store',
  '{
    "atributos": [
      { "clave": "razon_social", "etiqueta": "Razon social", "tipo": "text", "requerido": false },
      { "clave": "nit",          "etiqueta": "NIT",          "tipo": "text", "requerido": false },
      { "clave": "sector",       "etiqueta": "Sector",       "tipo": "text", "requerido": false }
    ],
    "indicadores": ["total_invertido","total_ingresos","total_egresos","balance","roi_acumulado","payback"],
    "genera_ingresos": true,
    "se_valoriza": false
  }'::jsonb
),
(
  null, 'inversion', 'Inversion', 'trending-up',
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
  null, 'otro', 'Otro', 'folder',
  '{
    "atributos": [],
    "indicadores": ["total_invertido","total_ingresos","total_egresos","balance","costo_mensual"],
    "genera_ingresos": true,
    "se_valoriza": false
  }'::jsonb
)
on conflict (propietario_id, codigo) do update
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
    select id into v_tipo_id from tipos_proyecto
     where propietario_id is null and codigo = p_tipo_codigo;
  end if;

  if p_padre is not null then
    select id into v_padre_id from categorias
     where propietario_id is null
       and nombre = p_padre
       and tipo_proyecto_id is not distinct from v_tipo_id
       and padre_id is null;
    if v_padre_id is null then
      raise exception 'Categoria padre "%" no encontrada para el tipo "%"', p_padre, p_tipo_codigo;
    end if;
  end if;

  insert into categorias (propietario_id, tipo_proyecto_id, padre_id, nombre, naturaleza, es_sistema, orden)
  values (null, v_tipo_id, v_padre_id, p_nombre, p_naturaleza, true, p_orden)
  on conflict (tipo_proyecto_id, padre_id, nombre) where propietario_id is null
  do update set naturaleza = excluded.naturaleza, orden = excluded.orden;
end;
$$;

-- 2.1 Transversales (aplican a todos los tipos de proyecto)
select pg_temp.sembrar_categoria(null, null, 'Financiacion',                    'financiacion', 90);
select pg_temp.sembrar_categoria(null, 'Financiacion', 'Desembolso de credito', 'financiacion', 1);
select pg_temp.sembrar_categoria(null, 'Financiacion', 'Cuota de credito',      'financiacion', 2);
select pg_temp.sembrar_categoria(null, 'Financiacion', 'Abono extraordinario a capital', 'financiacion', 3);
select pg_temp.sembrar_categoria(null, null, 'Otros ingresos',                  'ingreso', 95);
select pg_temp.sembrar_categoria(null, null, 'Otros egresos',                   'opex',    96);

-- 2.2 Inmueble (§3.1)
select pg_temp.sembrar_categoria('inmueble', null, 'Adquisicion', 'capex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Adquisicion', 'Separacion',            'capex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Adquisicion', 'Cuota inicial',         'capex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Adquisicion', 'Gastos notariales',     'capex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Adquisicion', 'Escrituracion',         'capex', 4);
select pg_temp.sembrar_categoria('inmueble', 'Adquisicion', 'Impuesto de registro',  'capex', 5);
select pg_temp.sembrar_categoria('inmueble', 'Adquisicion', 'Comision inmobiliaria', 'capex', 6);

select pg_temp.sembrar_categoria('inmueble', null, 'Mejoras y adecuaciones', 'capex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Remodelacion',            'capex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Muebles',                 'capex', 2);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Electrodomesticos',       'capex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Mejoras y adecuaciones', 'Otras adecuaciones',      'capex', 4);

select pg_temp.sembrar_categoria('inmueble', null, 'Sostenimiento', 'opex', 3);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Administracion',        'opex', 1);
select pg_temp.sembrar_categoria('inmueble', 'Sostenimiento', 'Servicios publicos',    'opex', 2);
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
select pg_temp.sembrar_categoria('vehiculo', null, 'Adquisicion', 'capex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisicion', 'Valor de compra', 'capex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisicion', 'Matricula',       'capex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisicion', 'Accesorios',      'capex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Adquisicion', 'Traspaso',        'capex', 4);

select pg_temp.sembrar_categoria('vehiculo', null, 'Mantenimiento', 'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Mantenimiento preventivo', 'opex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Cambio de aceite',         'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Cambio de llantas',        'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Frenos',                   'opex', 4);
select pg_temp.sembrar_categoria('vehiculo', 'Mantenimiento', 'Reparaciones',             'opex', 5);

select pg_temp.sembrar_categoria('vehiculo', null, 'Documentos e impuestos', 'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'SOAT',                     'opex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Revision tecnicomecanica', 'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Impuesto vehicular',       'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Renovacion de documentos', 'opex', 4);
select pg_temp.sembrar_categoria('vehiculo', 'Documentos e impuestos', 'Comparendos',              'opex', 5);

select pg_temp.sembrar_categoria('vehiculo', null, 'Operacion', 'opex', 4);
select pg_temp.sembrar_categoria('vehiculo', 'Operacion', 'Combustible',  'opex', 1);
select pg_temp.sembrar_categoria('vehiculo', 'Operacion', 'Parqueadero',  'opex', 2);
select pg_temp.sembrar_categoria('vehiculo', 'Operacion', 'Peajes',       'opex', 3);
select pg_temp.sembrar_categoria('vehiculo', 'Operacion', 'Lavado',       'opex', 4);

select pg_temp.sembrar_categoria('vehiculo', null, 'Seguros', 'opex', 5);
select pg_temp.sembrar_categoria('vehiculo', 'Seguros', 'Seguro todo riesgo', 'opex', 1);

-- 2.4 Negocio
select pg_temp.sembrar_categoria('negocio', null, 'Inversion inicial', 'capex', 1);
select pg_temp.sembrar_categoria('negocio', 'Inversion inicial', 'Constitucion legal',  'capex', 1);
select pg_temp.sembrar_categoria('negocio', 'Inversion inicial', 'Equipos',             'capex', 2);
select pg_temp.sembrar_categoria('negocio', 'Inversion inicial', 'Adecuacion de local', 'capex', 3);
select pg_temp.sembrar_categoria('negocio', 'Inversion inicial', 'Inventario inicial',  'capex', 4);

select pg_temp.sembrar_categoria('negocio', null, 'Operacion', 'opex', 2);
select pg_temp.sembrar_categoria('negocio', 'Operacion', 'Arriendo',    'opex', 1);
select pg_temp.sembrar_categoria('negocio', 'Operacion', 'Nomina',      'opex', 2);
select pg_temp.sembrar_categoria('negocio', 'Operacion', 'Servicios',   'opex', 3);
select pg_temp.sembrar_categoria('negocio', 'Operacion', 'Insumos',     'opex', 4);
select pg_temp.sembrar_categoria('negocio', 'Operacion', 'Publicidad',  'opex', 5);
select pg_temp.sembrar_categoria('negocio', 'Operacion', 'Impuestos',   'opex', 6);

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
select pg_temp.sembrar_categoria('inversion', 'Rendimientos', 'Valorizacion realizada','ingreso', 3);
select pg_temp.sembrar_categoria('inversion', 'Rendimientos', 'Retiro de capital',     'ingreso', 4);
