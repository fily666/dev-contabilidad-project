-- ============================================================================
-- Datos de prueba — 5 proyectos con historia completa
--
-- NO es `seed.sql`. Aquel siembra el catalogo del SISTEMA (tipos, categorias,
-- metodos de pago) y es parte de la instalacion; este llena la base con
-- informacion PROPIA de ejemplo para poder ver la aplicacion con datos y
-- ejercitar los indicadores de §5.3 sin registrar nada a mano.
--
--   npm run db:demo          # base vacia
--   npm run db:demo -- --force   # borrando lo que ya hubiera
--
-- Se ejecuta en dos partes:
--   A. Limpieza de toda la informacion propia (el catalogo del sistema queda).
--   B. Alta de 5 proyectos con movimientos, obligaciones, pasivos,
--      valoraciones y presupuestos.
--
-- Todas las fechas son RELATIVAS a current_date, asi que la demo nunca
-- envejece: los ultimos 12 meses siempre tienen movimientos (v_metricas_12m),
-- la agenda siempre tiene vencimientos proximos y uno vencido, y el flujo
-- proyectado siempre mira hacia adelante.
--
-- Lo que este archivo NO crea, y por que:
--   · documentos → la fila apunta a un archivo en Storage; sin el archivo, la
--     descarga daria 404. Los soportes se cargan desde la aplicacion.
--   · notificaciones → las programa la tarea de §10.1 a partir de las
--     ocurrencias, que si se crean aqui.
-- ============================================================================

-- ─── A. Limpieza ────────────────────────────────────────────────────────────
-- Un solo truncate para todas: entre estas tablas hay ciclos de clave ajena
-- (movimientos ↔ ocurrencias_obligacion) que un delete tendria que desarmar a
-- mano. Sin `cascade` a proposito: si algun dia aparece una tabla nueva que
-- referencie a estas y no este en la lista, se quiere el error, no un borrado
-- silencioso mas amplio del declarado.
--
-- `restart identity` por el bigserial de registro_auditoria: la demo se rehace
-- muchas veces y no tiene sentido que los ids arranquen en 40 000.
--
-- El catalogo (tipos_proyecto, categorias, metodos_pago) y ajustes se
-- conservan: los siembra seed.sql y estan protegidos por trigger.
truncate table
  registro_auditoria,
  notificaciones,
  documentos,
  ocurrencias_obligacion,
  movimientos,
  obligaciones,
  presupuestos,
  valoraciones,
  pasivos,
  proyectos
  restart identity;

-- ─── Utilidades de la demo ──────────────────────────────────────────────────
-- Viven en pg_temp: son andamio de este archivo y desaparecen al cerrar la
-- sesion. Ninguna queda en el esquema.

-- Fecha relativa al mes corriente. Meses negativos apuntan al futuro.
-- Con dia <= 28 para que ningun mes desborde al siguiente.
create or replace function pg_temp.f(p_meses_atras int, p_dia int default 1)
returns date
language sql
immutable
as $$
  select (
    date_trunc('month', current_date)
    - (p_meses_atras || ' months')::interval
    + ((p_dia - 1) || ' days')::interval
  )::date;
$$;

-- Categoria por nombre. `p_tipo` es el codigo del tipo de proyecto, o null para
-- las transversales (Financiación, Otros ingresos…). Falla si no existe o si el
-- nombre es ambiguo dentro del tipo: un id equivocado aqui produciria cifras
-- verosimiles pero mal clasificadas, que es lo peor que puede pasarle a la demo.
create or replace function pg_temp.cat(p_tipo text, p_nombre text)
returns uuid
language plpgsql
as $$
declare
  v_ids uuid[];
begin
  select array_agg(c.id)
    into v_ids
    from categorias c
    left join tipos_proyecto t on t.id = c.tipo_proyecto_id
   where c.nombre = p_nombre
     and case
           when p_tipo is null then c.tipo_proyecto_id is null
           else t.codigo = p_tipo
         end;

  if v_ids is null then
    raise exception 'Categoria "%" no existe para el tipo "%"',
      p_nombre, coalesce(p_tipo, '(transversal)');
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception 'Categoria "%" es ambigua en el tipo "%"',
      p_nombre, coalesce(p_tipo, '(transversal)');
  end if;

  return v_ids[1];
end;
$$;

create or replace function pg_temp.proy(p_nombre text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from proyectos where nombre = p_nombre;
  if v_id is null then
    raise exception 'Proyecto "%" no existe', p_nombre;
  end if;
  return v_id;
end;
$$;

-- Un movimiento. La naturaleza se toma de la categoria (RF-21 permite
-- sobreescribirla en la aplicacion; la demo no la contradice nunca) y el tipo se
-- deduce de la naturaleza, salvo en 'financiacion', que sirve a las dos
-- direcciones: el desembolso entra y la cuota sale. Ahi hay que decirlo.
create or replace function pg_temp.mov(
  p_proyecto       text,
  p_tipo_proyecto  text,
  p_categoria      text,
  p_fecha          date,
  p_valor          numeric,
  p_descripcion    text,
  p_estado         estado_movimiento default 'pagado',
  p_metodo         text              default 'Transferencia',
  p_tipo           tipo_movimiento   default null,
  p_vencimiento    date              default null,
  p_capital        numeric           default null,
  p_interes        numeric           default null
) returns uuid
language plpgsql
as $$
declare
  v_categoria_id uuid := pg_temp.cat(p_tipo_proyecto, p_categoria);
  v_naturaleza   naturaleza_categoria;
  v_tipo         tipo_movimiento;
  v_id           uuid;
begin
  select naturaleza into v_naturaleza from categorias where id = v_categoria_id;

  v_tipo := coalesce(
    p_tipo,
    case when v_naturaleza = 'ingreso' then 'ingreso' else 'egreso' end::tipo_movimiento
  );

  insert into movimientos (
    proyecto_id, categoria_id, metodo_pago_id, tipo, naturaleza,
    fecha, fecha_vencimiento, fecha_pago, valor, moneda,
    abono_capital, abono_interes, descripcion, estado
  ) values (
    pg_temp.proy(p_proyecto),
    v_categoria_id,
    (select id from metodos_pago where nombre = p_metodo),
    v_tipo,
    v_naturaleza,
    p_fecha,
    p_vencimiento,
    case when p_estado = 'pagado' then p_fecha end,
    p_valor,
    'COP',
    p_capital,
    p_interes,
    p_descripcion,
    p_estado
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Una serie mensual (arriendo, nomina, combustible…). El sufijo MM/YYYY en la
-- descripcion evita 16 filas indistinguibles en el listado.
--
-- `p_variacion` mueve el valor de forma determinista dentro de ±variacion: sin
-- ella las graficas de §5.2 salen planas y no se distingue una tendencia real de
-- un error de agregacion. Determinista y no aleatoria para que dos ejecuciones
-- de la demo den exactamente las mismas cifras.
create or replace function pg_temp.mov_serie(
  p_proyecto      text,
  p_tipo_proyecto text,
  p_categoria     text,
  p_desde         date,
  p_meses         int,
  p_valor         numeric,
  p_descripcion   text,
  p_variacion     numeric         default 0,
  p_metodo        text            default 'Transferencia',
  p_tipo          tipo_movimiento default null
) returns int
language plpgsql
as $$
declare
  v_i      int;
  v_fecha  date;
  v_valor  numeric;
  v_factor numeric;
begin
  for v_i in 0 .. p_meses - 1 loop
    -- date + interval de meses recorta al ultimo dia del mes destino (31 ene +
    -- 1 mes = 28 feb), que es justo lo que se quiere para una cuota mensual.
    v_fecha := (p_desde + (v_i || ' months')::interval)::date;

    -- Las series se declaran hasta el mes corriente para que el panel del mes en
    -- curso nunca aparezca vacio, y se cortan aqui: segun el dia en que se
    -- ejecute la demo, la ultima cuota del mes puede no haber llegado todavia, y
    -- un movimiento 'pagado' con fecha futura seria una mentira.
    exit when v_fecha > current_date;

    v_factor := 1 + p_variacion * ((((v_i * 7) % 5) - 2) / 2.0);
    v_valor  := round(p_valor * v_factor / 1000) * 1000;

    perform pg_temp.mov(
      p_proyecto, p_tipo_proyecto, p_categoria, v_fecha, v_valor,
      p_descripcion || ' ' || to_char(v_fecha, 'MM/YYYY'),
      'pagado', p_metodo, p_tipo
    );
  end loop;

  return p_meses;
end;
$$;

-- Cuota de credito: egreso de naturaleza 'financiacion' con el desglose
-- capital / interes que exige el check `desglose_credito` y que alimenta
-- `abonos_a_capital` de v_resumen_proyecto.
create or replace function pg_temp.cuota_serie(
  p_proyecto text,
  p_desde    date,
  p_meses    int,
  p_valor    numeric,
  p_capital  numeric,
  p_concepto text
) returns int
language plpgsql
as $$
declare
  v_i     int;
  v_fecha date;
begin
  for v_i in 0 .. p_meses - 1 loop
    v_fecha := (p_desde + (v_i || ' months')::interval)::date;
    exit when v_fecha > current_date;   -- igual que mov_serie
    perform pg_temp.mov(
      p_proyecto, null, 'Cuota de crédito', v_fecha, p_valor,
      p_concepto || ' ' || to_char(v_fecha, 'MM/YYYY'),
      'pagado', 'Debito automatico', 'egreso', null,
      p_capital, p_valor - p_capital
    );
  end loop;

  return p_meses;
end;
$$;

create or replace function pg_temp.obligacion(
  p_proyecto      text,
  p_tipo_proyecto text,
  p_categoria     text,
  p_concepto      text,
  p_valor         numeric,
  p_vencimiento   date,
  p_frecuencia    frecuencia,
  p_auto          boolean default false
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into obligaciones (
    proyecto_id, categoria_id, concepto, valor_estimado,
    fecha_vencimiento, frecuencia, crear_movimiento_auto
  ) values (
    pg_temp.proy(p_proyecto),
    pg_temp.cat(p_tipo_proyecto, p_categoria),
    p_concepto,
    p_valor,
    p_vencimiento,
    p_frecuencia,
    p_auto
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function pg_temp.presupuesto(
  p_proyecto      text,
  p_tipo_proyecto text,
  p_categoria     text,
  p_inicio        date,
  p_fin           date,
  p_valor         numeric,
  p_notas         text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into presupuestos (
    proyecto_id, categoria_id, periodo_inicio, periodo_fin, valor_planeado, notas
  ) values (
    pg_temp.proy(p_proyecto),
    pg_temp.cat(p_tipo_proyecto, p_categoria),
    p_inicio, p_fin, p_valor, p_notas
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- B. Los cinco proyectos
--
-- Elegidos para que entre todos ejerciten TODOS los indicadores de §13 y las
-- cinco vistas de agregacion:
--
--   1. Apartamento 302 — inmueble    · ingresos + hipoteca + valorizacion
--      → yield neto, cap rate, ROI, payback, plusvalia, patrimonio neto
--   2. Mazda CX-30    — vehiculo     · solo egresos + credito + depreciacion
--      → TCO, costo mensual, plusvalia negativa
--   3. Café de la 70  — negocio      · operacion viva con ingresos y gastos
--      → balance, ROI, payback, ejecucion presupuestal
--   4. Casa El Retiro — construccion · capex en curso, sin ingresos todavia
--      → capital aportado, obra en ejecucion, movimientos comprometidos
--   5. Portafolio Cripto — cripto    · aportes pequeños y valorizacion fuerte
--      → retorno total, plusvalia; y un proyecto en estado 'pausado'
-- ============================================================================

insert into proyectos (tipo_proyecto_id, nombre, descripcion, fecha_inicio, estado, moneda, atributos)
select t.id, d.nombre, d.descripcion, d.fecha_inicio, d.estado::estado_proyecto, 'COP', d.atributos
  from (values
    (
      'inmueble',
      'Apartamento 302 — Laureles',
      'Apartamento de 78 m² comprado para arrendar. Financiado con hipoteca a 15 años.',
      pg_temp.f(26, 12),
      'activo',
      '{"direccion": "Carrera 76 #C1-45, apto 302", "ciudad": "Medellín", "matricula": "001-1234567", "area_m2": 78, "estrato": 5}'::jsonb
    ),
    (
      'vehiculo',
      'Mazda CX-30 Grand Touring',
      'Vehículo familiar comprado con crédito a 60 meses. Sin uso comercial.',
      pg_temp.f(14, 8),
      'activo',
      '{"placa": "KRT-482", "marca": "Mazda", "linea": "CX-30 Grand Touring", "modelo": 2024, "cilindraje": 2000}'::jsonb
    ),
    (
      'negocio',
      'Café de la 70',
      'Cafetería de barrio, 6 mesas. Sociedad propia con un empleado de planta.',
      pg_temp.f(18, 3),
      'activo',
      '{"razon_social": "Café de la 70 S.A.S.", "nit": "901.556.221-4", "sector": "Alimentos y bebidas"}'::jsonb
    ),
    (
      'construccion',
      'Casa El Retiro',
      'Construcción de vivienda en lote propio. Obra gris terminada, en acabados.',
      pg_temp.f(9, 5),
      'activo',
      '{"direccion": "Vereda Los Salados, lote 12, El Retiro", "area_lote_m2": 1200, "area_construida": 210, "licencia": "LC-2025-0842"}'::jsonb
    ),
    (
      'cripto',
      'Portafolio Cripto',
      'Compras periódicas de BTC y ETH. Aportes suspendidos, posición en hold.',
      pg_temp.f(20, 15),
      'pausado',
      '{"activo": "BTC / ETH", "exchange": "Binance", "red": "Bitcoin / Ethereum"}'::jsonb
    )
  ) as d(tipo, nombre, descripcion, fecha_inicio, estado, atributos)
  join tipos_proyecto t on t.codigo = d.tipo;

-- La fecha de entrega estimada es relativa como todo lo demas, y en jsonb no se
-- puede calcular dentro del literal.
update proyectos
   set atributos = atributos || jsonb_build_object('fecha_entrega', pg_temp.f(-7, 20)::text)
 where nombre = 'Casa El Retiro';

-- ─── 1. Apartamento 302 — Laureles ──────────────────────────────────────────
-- Compra hace 24 meses por 285 M: 90 M de cuota inicial y 210 M de hipoteca.
-- Arrendado desde el mes 22, con reajuste de canon en el mes 10.

-- Adquisicion (capex)
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Separación',           pg_temp.f(26, 12),  8000000, 'Separación del inmueble');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Cuota inicial',        pg_temp.f(24, 10), 82000000, 'Cuota inicial (saldo tras separación)');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Gastos notariales',    pg_temp.f(24, 10),  3200000, 'Gastos notariales de la escritura');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Escrituración',        pg_temp.f(24, 10),  2800000, 'Derechos de escrituración');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Impuesto de registro', pg_temp.f(24, 15),  4100000, 'Impuesto de registro y beneficencia');

-- Mejoras antes de arrendar (capex)
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Remodelación',       pg_temp.f(23, 5), 12500000, 'Remodelación de cocina y baños');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Muebles',            pg_temp.f(23, 20), 6800000, 'Dotación de muebles');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Electrodomésticos',  pg_temp.f(22, 8),  4200000, 'Nevera, estufa y lavadora');

-- Hipoteca: pasivo y 24 cuotas, SIN movimiento de desembolso.
--
-- Es la decision de modelado que mas afecta las cifras, y sigue al catalogo de
-- categorias: «Adquisición» de un inmueble tiene Separación, Cuota inicial y
-- gastos, pero ninguna linea para la parte financiada del precio — porque el
-- banco le paga al vendedor, no al comprador. Asi, total_invertido es el dinero
-- propio, y como §5.1 define `total_ingresos` incluyendo la naturaleza
-- 'financiacion', registrar un desembolso de 210 M haria que el ROI de §5.3
-- (que divide por total_invertido) diera 160 % en un arriendo. El credito vive
-- en `pasivos`, que es de donde sale el patrimonio neto de RF-78.
--
-- El criterio para los cinco proyectos: el desembolso se registra solo en los
-- tipos que NO muestran ROI ni total_ingresos segun la tabla de §5.4 —vehiculo y
-- construccion—, donde deja ver la financiacion sin ensuciar ningun indicador.
insert into pasivos (proyecto_id, nombre, tipo, monto_original, saldo_actual, tasa_interes_ea, plazo_meses, valor_cuota, fecha_desembolso)
values (
  pg_temp.proy('Apartamento 302 — Laureles'),
  'Crédito hipotecario Bancolombia', 'credito_hipotecario',
  210000000, 191600000, 0.1250, 180, 2590000, pg_temp.f(24, 10)
);

select pg_temp.cuota_serie('Apartamento 302 — Laureles', pg_temp.f(23, 5), 24, 2590000, 620000, 'Cuota hipoteca');

-- Arrendamiento (ingreso): 12 meses a 2,9 M y 10 a 3,1 M tras el reajuste
select pg_temp.mov_serie('Apartamento 302 — Laureles', 'inmueble', 'Canon de arrendamiento', pg_temp.f(22, 5), 12, 2900000, 'Canon de arrendamiento');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Reajuste de canon', pg_temp.f(10, 5), 200000, 'Reajuste anual del canon (IPC + 1 pto)');
select pg_temp.mov_serie('Apartamento 302 — Laureles', 'inmueble', 'Canon de arrendamiento', pg_temp.f(10, 5), 11, 3100000, 'Canon de arrendamiento');

-- El canon del mes entrante, comprometido y sin cobrar todavia. Es lo unico que
-- alimenta `ingresos_esperados` en v_flujo_proyectado_mensual: las obligaciones
-- solo modelan egresos, asi que sin algun ingreso pendiente el flujo proyectado
-- se ve como puro gasto.
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Canon de arrendamiento', pg_temp.f(-1, 5), 3100000, 'Canon de arrendamiento del mes entrante', 'pendiente', 'Transferencia', null, pg_temp.f(-1, 5));

-- Sostenimiento e impuestos (opex)
select pg_temp.mov_serie('Apartamento 302 — Laureles', 'inmueble', 'Administración', pg_temp.f(22, 7), 23, 380000, 'Cuota de administración');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Impuesto predial',  pg_temp.f(19, 20), 1780000, 'Impuesto predial con descuento por pronto pago');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Impuesto predial',  pg_temp.f(7, 18),  1850000, 'Impuesto predial con descuento por pronto pago');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Seguro de hogar',   pg_temp.f(20, 3),   580000, 'Póliza de hogar, vigencia anual');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Seguro de hogar',   pg_temp.f(8, 3),    620000, 'Renovación póliza de hogar');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Reparaciones',      pg_temp.f(14, 22),  950000, 'Cambio de calentador');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Reparaciones',      pg_temp.f(4, 11),   430000, 'Filtración en baño auxiliar');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Cuotas extraordinarias', pg_temp.f(6, 7), 1200000, 'Cuota extraordinaria: fachada del edificio');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Servicios públicos', pg_temp.f(22, 18), 240000, 'Servicios del mes sin arrendar');
select pg_temp.mov('Apartamento 302 — Laureles', 'inmueble', 'Reembolsos del inquilino', pg_temp.f(4, 25), 430000, 'Reembolso de la filtración del baño');

-- Valorizacion
insert into valoraciones (proyecto_id, fecha, valor, fuente, notas) values
  (pg_temp.proy('Apartamento 302 — Laureles'), pg_temp.f(24, 10), 285000000, 'Precio de compra', 'Valor de la escritura'),
  (pg_temp.proy('Apartamento 302 — Laureles'), pg_temp.f(12, 15), 315000000, 'Avalúo comercial',  'Avalúo para renovación del seguro'),
  (pg_temp.proy('Apartamento 302 — Laureles'), pg_temp.f(1, 20),  342000000, 'Estimación propia', 'Comparables del sector publicados en portales');

-- ─── 2. Mazda CX-30 Grand Touring ───────────────────────────────────────────
-- Compra hace 14 meses por 132,7 M: 72,7 M propios y 60 M de crédito.

select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Valor de compra', pg_temp.f(14, 8), 128000000, 'Valor de compra en concesionario');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Matrícula',       pg_temp.f(14, 8),   1450000, 'Matrícula y placas');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Accesorios',      pg_temp.f(14, 20),  3200000, 'Polarizado, sensores y tapetes');

-- Aqui si se registra el desembolso: vehiculo no muestra ROI ni total_ingresos
-- (§5.4), y el precio completo como capex es lo que hace que la plusvalia
-- —depreciacion, en este tipo— salga negativa como debe ser.
select pg_temp.mov('Mazda CX-30 Grand Touring', null, 'Desembolso de crédito', pg_temp.f(14, 8), 60000000, 'Desembolso crédito de vehículo', 'pagado', 'Transferencia', 'ingreso');

insert into pasivos (proyecto_id, nombre, tipo, monto_original, saldo_actual, tasa_interes_ea, plazo_meses, valor_cuota, fecha_desembolso)
values (
  pg_temp.proy('Mazda CX-30 Grand Touring'),
  'Crédito de vehículo Davivienda', 'credito_vehiculo',
  60000000, 47380000, 0.1490, 60, 1480000, pg_temp.f(14, 8)
);

select pg_temp.cuota_serie('Mazda CX-30 Grand Touring', pg_temp.f(13, 8), 14, 1480000, 740000, 'Cuota crédito vehículo');

-- Operacion y mantenimiento (opex)
select pg_temp.mov_serie('Mazda CX-30 Grand Touring', 'vehiculo', 'Combustible', pg_temp.f(13, 6),  14, 720000, 'Combustible del mes', 0.18, 'Tarjeta de credito');
select pg_temp.mov_serie('Mazda CX-30 Grand Touring', 'vehiculo', 'Parqueadero', pg_temp.f(13, 2),  14, 190000, 'Parqueadero mensual');
select pg_temp.mov_serie('Mazda CX-30 Grand Touring', 'vehiculo', 'Lavado',      pg_temp.f(12, 14),  6,  45000, 'Lavado', 0.2, 'Efectivo');
select pg_temp.mov_serie('Mazda CX-30 Grand Touring', 'vehiculo', 'Peajes',      pg_temp.f(10, 9),   4, 120000, 'Peajes de viaje', 0.3, 'Efectivo');

select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'SOAT',                     pg_temp.f(14, 8),   980000, 'SOAT, vigencia un año');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'SOAT',                     pg_temp.f(2, 8),   1040000, 'Renovación SOAT');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Seguro todo riesgo',       pg_temp.f(14, 8),  3850000, 'Póliza todo riesgo, vigencia un año');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Seguro todo riesgo',       pg_temp.f(2, 8),   4120000, 'Renovación póliza todo riesgo');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Impuesto vehicular',       pg_temp.f(9, 25),  1640000, 'Impuesto vehicular del año anterior');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Mantenimiento preventivo', pg_temp.f(9, 12),   890000, 'Mantenimiento de 10 000 km');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Mantenimiento preventivo', pg_temp.f(3, 16),   940000, 'Mantenimiento de 20 000 km');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Cambio de aceite',         pg_temp.f(6, 9),    320000, 'Cambio de aceite y filtros');
select pg_temp.mov('Mazda CX-30 Grand Touring', 'vehiculo', 'Comparendos',              pg_temp.f(5, 24),   522000, 'Comparendo por exceso de velocidad');

-- Depreciacion
insert into valoraciones (proyecto_id, fecha, valor, fuente, notas) values
  (pg_temp.proy('Mazda CX-30 Grand Touring'), pg_temp.f(14, 8), 128000000, 'Precio de compra',  'Valor de factura'),
  (pg_temp.proy('Mazda CX-30 Grand Touring'), pg_temp.f(7, 10), 118000000, 'Guía Fasecolda',    'Consulta de valor comercial'),
  (pg_temp.proy('Mazda CX-30 Grand Touring'), pg_temp.f(1, 10), 109500000, 'Guía Fasecolda',    'Consulta de valor comercial');

-- ─── 3. Café de la 70 ───────────────────────────────────────────────────────
-- Abierto hace 18 meses. 66,7 M de inversión inicial, 40 M con crédito libre.

select pg_temp.mov('Café de la 70', 'negocio', 'Constitución legal',  pg_temp.f(18, 3),   1800000, 'Constitución de la S.A.S. y registro mercantil');
select pg_temp.mov('Café de la 70', 'negocio', 'Adecuación de local', pg_temp.f(18, 10), 22500000, 'Obra y mobiliario del local');
select pg_temp.mov('Café de la 70', 'negocio', 'Equipos',             pg_temp.f(17, 6),  34000000, 'Máquina de espresso, molino y nevera');
select pg_temp.mov('Café de la 70', 'negocio', 'Inventario inicial',  pg_temp.f(17, 20),  8400000, 'Inventario de apertura');

-- Sin movimiento de desembolso, por lo mismo que la hipoteca del apartamento:
-- negocio muestra ROI y payback (§5.4), y un ingreso de 40 M que no es una venta
-- los volveria ilegibles. total_ingresos del negocio = ventas.
insert into pasivos (proyecto_id, nombre, tipo, monto_original, saldo_actual, tasa_interes_ea, plazo_meses, valor_cuota, fecha_desembolso)
values (
  pg_temp.proy('Café de la 70'),
  'Crédito libre inversión BBVA', 'credito_libre',
  40000000, 27460000, 0.2190, 48, 1290000, pg_temp.f(18, 3)
);

select pg_temp.cuota_serie('Café de la 70', pg_temp.f(17, 3), 18, 1290000, 570000, 'Cuota crédito libre');

-- Un abono extraordinario: la razon de ser de `abonos_a_capital`
select pg_temp.mov('Café de la 70', null, 'Abono extraordinario a capital', pg_temp.f(6, 14), 4000000, 'Abono extraordinario a capital del crédito', 'pagado', 'Transferencia', 'egreso', null, 4000000, 0);

-- Operacion (opex), 17 meses
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Arriendo',   pg_temp.f(17, 5),  18, 4200000, 'Arriendo del local');
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Nómina',     pg_temp.f(17, 28), 18, 3950000, 'Nómina y prestaciones');
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Servicios',  pg_temp.f(17, 15), 18, 1350000, 'Servicios públicos e internet', 0.14);
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Insumos',    pg_temp.f(17, 9),  18, 6500000, 'Compra de insumos', 0.16);
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Publicidad', pg_temp.f(14, 11),  8,  480000, 'Pauta en redes', 0.25, 'Tarjeta de credito');

-- Impuestos trimestrales (opex)
select pg_temp.mov('Café de la 70', 'negocio', 'Impuestos', pg_temp.f(15, 18), 1680000, 'Declaración de IVA del bimestre');
select pg_temp.mov('Café de la 70', 'negocio', 'Impuestos', pg_temp.f(12, 18), 1920000, 'Declaración de IVA del bimestre');
select pg_temp.mov('Café de la 70', 'negocio', 'Impuestos', pg_temp.f(9, 18),  2100000, 'Declaración de IVA del bimestre');
select pg_temp.mov('Café de la 70', 'negocio', 'Impuestos', pg_temp.f(6, 18),  2240000, 'Declaración de IVA del bimestre');
select pg_temp.mov('Café de la 70', 'negocio', 'Impuestos', pg_temp.f(3, 18),  2380000, 'Declaración de IVA del bimestre');

-- Ventas (ingreso). Arranque flojo los tres primeros meses y luego el ritmo de
-- crucero: sin eso el payback sale en linea recta y no se distingue nada.
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Venta de productos', pg_temp.f(17, 28), 3,  14500000, 'Ventas del mes (apertura)', 0.1);
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Venta de productos', pg_temp.f(14, 28), 15, 24500000, 'Ventas del mes', 0.12);
select pg_temp.mov_serie('Café de la 70', 'negocio', 'Venta de servicios', pg_temp.f(11, 28), 12, 1800000, 'Eventos y alquiler del local', 0.3);

-- Evento ya contratado y facturado, todavia sin cobrar (ingreso esperado)
select pg_temp.mov('Café de la 70', 'negocio', 'Venta de servicios', pg_temp.f(-1, 12), 2600000, 'Evento privado contratado para el mes entrante', 'pendiente', 'Transferencia', null, pg_temp.f(-1, 20));

-- ─── 4. Casa El Retiro ──────────────────────────────────────────────────────
-- Lote comprado hace 9 meses; obra en curso. Sin ingresos: se_valoriza pero no
-- genera_ingresos. Tiene movimientos comprometidos (pendientes) a futuro, que
-- es lo que alimenta v_flujo_proyectado_mensual.

select pg_temp.mov('Casa El Retiro', 'construccion', 'Compra del lote',      pg_temp.f(9, 5),  180000000, 'Compra del lote de 1 200 m²');
select pg_temp.mov('Casa El Retiro', 'construccion', 'Estudios y licencias', pg_temp.f(8, 12),  14500000, 'Estudio de suelos y licencia de construcción');
select pg_temp.mov('Casa El Retiro', 'construccion', 'Diseño y honorarios',  pg_temp.f(8, 20),  22000000, 'Diseño arquitectónico y estructural');

select pg_temp.mov_serie('Casa El Retiro', 'construccion', 'Materiales',   pg_temp.f(6, 8), 7, 18000000, 'Materiales de obra', 0.22);
select pg_temp.mov_serie('Casa El Retiro', 'construccion', 'Mano de obra', pg_temp.f(6, 25), 6, 12500000, 'Mano de obra del mes', 0.12);
select pg_temp.mov_serie('Casa El Retiro', 'construccion', 'Servicios públicos', pg_temp.f(6, 16), 7, 450000, 'Servicios provisionales de obra', 0.2);
select pg_temp.mov_serie('Casa El Retiro', 'construccion', 'Vigilancia',   pg_temp.f(6, 3), 7, 1200000, 'Vigilancia de la obra');

select pg_temp.mov('Casa El Retiro', 'construccion', 'Acabados', pg_temp.f(1, 14), 8900000, 'Primer avance de acabados: pisos');

-- Credito constructor: dos desembolsos y cuotas de solo interes durante la obra.
-- Los desembolsos se registran porque aqui el dinero si pasa por las manos del
-- dueño y se gasta en materiales y mano de obra que estan mas abajo como capex;
-- y construccion tampoco muestra ROI (§5.4).
select pg_temp.mov('Casa El Retiro', null, 'Desembolso de crédito', pg_temp.f(6, 5), 60000000, 'Primer desembolso del crédito constructor', 'pagado', 'Transferencia', 'ingreso');
select pg_temp.mov('Casa El Retiro', null, 'Desembolso de crédito', pg_temp.f(3, 5), 45000000, 'Segundo desembolso del crédito constructor', 'pagado', 'Transferencia', 'ingreso');

insert into pasivos (proyecto_id, nombre, tipo, monto_original, saldo_actual, tasa_interes_ea, plazo_meses, valor_cuota, fecha_desembolso)
values (
  pg_temp.proy('Casa El Retiro'),
  'Crédito constructor Banco de Bogotá', 'credito_hipotecario',
  150000000, 105000000, 0.1380, 240, 1520000, pg_temp.f(6, 5)
);

-- capital 0: durante la construccion solo se abonan intereses. El check
-- desglose_credito lo admite (capital >= 0) y `abonos_a_capital` queda en cero,
-- que es la verdad del proyecto.
select pg_temp.cuota_serie('Casa El Retiro', pg_temp.f(5, 10), 6, 1520000, 0, 'Intereses crédito constructor');

-- Comprometido pero no ejecutado
select pg_temp.mov('Casa El Retiro', 'construccion', 'Acabados',   pg_temp.f(-1, 14), 15400000, 'Acabados: enchapes y carpintería', 'pendiente', 'Transferencia', null, pg_temp.f(-1, 14));
select pg_temp.mov('Casa El Retiro', 'construccion', 'Materiales', pg_temp.f(-2, 8),  11200000, 'Ventanería y vidrios',              'pendiente', 'Transferencia', null, pg_temp.f(-2, 8));
select pg_temp.mov('Casa El Retiro', 'construccion', 'Mano de obra', pg_temp.f(0, 25),  12500000, 'Mano de obra del mes',            'pendiente', 'Transferencia', null, pg_temp.f(0, 25));

insert into valoraciones (proyecto_id, fecha, valor, fuente, notas) values
  (pg_temp.proy('Casa El Retiro'), pg_temp.f(9, 5), 194000000, 'Costo del lote',    'Lote más estudios iniciales'),
  (pg_temp.proy('Casa El Retiro'), pg_temp.f(4, 12), 268000000, 'Avalúo del banco', 'Avalúo de avance de obra para el segundo desembolso'),
  (pg_temp.proy('Casa El Retiro'), pg_temp.f(1, 20), 340000000, 'Avalúo del banco', 'Obra gris terminada');

-- ─── 5. Portafolio Cripto ───────────────────────────────────────────────────
-- Compras periodicas pequeñas y valorizacion fuerte: el caso donde la plusvalia
-- domina el retorno y las cifras de caja dicen poco por si solas.

select pg_temp.mov_serie('Portafolio Cripto', 'cripto', 'Compras', pg_temp.f(20, 15), 14, 1500000, 'Compra periódica BTC/ETH', 0.2);
select pg_temp.mov_serie('Portafolio Cripto', 'cripto', 'Comisiones de transacción', pg_temp.f(20, 15), 14, 22000, 'Comisión de la compra', 0.2);
select pg_temp.mov('Portafolio Cripto', 'cripto', 'Retiros y redes', pg_temp.f(9, 22), 118000, 'Comisión de red por retiro a wallet propia');
select pg_temp.mov('Portafolio Cripto', 'cripto', 'Retiros y redes', pg_temp.f(2, 17),  96000, 'Comisión de red por retiro a wallet propia');

select pg_temp.mov_serie('Portafolio Cripto', 'cripto', 'Staking', pg_temp.f(12, 28), 13, 185000, 'Recompensa de staking ETH', 0.25);
select pg_temp.mov('Portafolio Cripto', 'cripto', 'Venta realizada', pg_temp.f(5, 9), 9500000, 'Venta parcial de BTC para tomar utilidad');

insert into valoraciones (proyecto_id, fecha, valor, fuente, notas) values
  (pg_temp.proy('Portafolio Cripto'), pg_temp.f(20, 15),  1500000, 'Exchange', 'Valor del portafolio tras la primera compra'),
  (pg_temp.proy('Portafolio Cripto'), pg_temp.f(12, 15), 22400000, 'Exchange', 'Cierre del mes'),
  (pg_temp.proy('Portafolio Cripto'), pg_temp.f(6, 15),  38900000, 'Exchange', 'Cierre del mes'),
  (pg_temp.proy('Portafolio Cripto'), pg_temp.f(1, 15),  47200000, 'Exchange', 'Cierre del mes');

-- ─── Obligaciones (RF-55 y siguientes) ──────────────────────────────────────
-- Todas apuntan al PROXIMO vencimiento, no al primero de la historia: las
-- ocurrencias pasadas ya estan registradas como movimientos pagados, y
-- generar_ocurrencias() volveria a proyectarlas como pendientes, contando dos
-- veces lo mismo en el flujo proyectado.
--
-- La excepcion es el impuesto vehicular, con vencimiento hace unos dias y a
-- proposito: la agenda y las alertas de RF-73 necesitan algo vencido que mostrar.

select pg_temp.obligacion('Apartamento 302 — Laureles', null,        'Cuota de crédito',  'Cuota hipoteca Bancolombia',    2590000, pg_temp.f(-1, 5),  'mensual', true);
select pg_temp.obligacion('Apartamento 302 — Laureles', 'inmueble',  'Administración',    'Administración del edificio',    380000, pg_temp.f(-1, 7),  'mensual', true);
select pg_temp.obligacion('Apartamento 302 — Laureles', 'inmueble',  'Impuesto predial',  'Impuesto predial',              1920000, pg_temp.f(-5, 18), 'anual');
select pg_temp.obligacion('Apartamento 302 — Laureles', 'inmueble',  'Seguro de hogar',   'Renovación póliza de hogar',     660000, pg_temp.f(-4, 3),  'anual');

select pg_temp.obligacion('Mazda CX-30 Grand Touring', null,       'Cuota de crédito',   'Cuota crédito vehículo',        1480000, pg_temp.f(-1, 8),  'mensual', true);
select pg_temp.obligacion('Mazda CX-30 Grand Touring', 'vehiculo', 'Impuesto vehicular', 'Impuesto vehicular',            1720000, current_date - 9,  'anual');
select pg_temp.obligacion('Mazda CX-30 Grand Touring', 'vehiculo', 'SOAT',               'Renovación SOAT',               1040000, pg_temp.f(-10, 8), 'anual');
select pg_temp.obligacion('Mazda CX-30 Grand Touring', 'vehiculo', 'Revisión tecnicomecánica', 'Revisión tecnicomecánica', 380000, pg_temp.f(-2, 14), 'anual');

select pg_temp.obligacion('Café de la 70', null,      'Cuota de crédito', 'Cuota crédito libre inversión', 1290000, pg_temp.f(-1, 3),  'mensual', true);
select pg_temp.obligacion('Café de la 70', 'negocio', 'Arriendo',         'Arriendo del local',            4200000, pg_temp.f(-1, 5),  'mensual', true);
select pg_temp.obligacion('Café de la 70', 'negocio', 'Nómina',           'Nómina y prestaciones',         3950000, pg_temp.f(-1, 28), 'mensual');
select pg_temp.obligacion('Café de la 70', 'negocio', 'Impuestos',        'Declaración de IVA',            2380000, pg_temp.f(0, 18),  'bimestral');

select pg_temp.obligacion('Casa El Retiro', null,           'Cuota de crédito',   'Intereses crédito constructor', 1520000, pg_temp.f(-1, 10), 'mensual', true);
select pg_temp.obligacion('Casa El Retiro', 'construccion', 'Vigilancia',         'Vigilancia de la obra',         1200000, pg_temp.f(-1, 3),  'mensual');
select pg_temp.obligacion('Casa El Retiro', 'construccion', 'Servicios públicos', 'Servicios provisionales',        450000, pg_temp.f(-1, 16), 'mensual');

-- ─── Presupuestos (RF-80 a RF-82) ───────────────────────────────────────────
-- Sobre categorias RAIZ: v_presupuesto_ejecucion suma tambien las subcategorias,
-- y presupuestar cada hoja no seria utilizable. Los periodos son el año movil o
-- el trimestre en curso para que la ejecucion muestre cifras, no ceros.

select pg_temp.presupuesto('Apartamento 302 — Laureles', 'inmueble', 'Sostenimiento',        pg_temp.f(11), pg_temp.f(-1) - 1,  7200000, 'Administración, servicios y reparaciones del año');
select pg_temp.presupuesto('Apartamento 302 — Laureles', 'inmueble', 'Impuestos y seguros',  pg_temp.f(11), pg_temp.f(-1) - 1,  2600000, 'Predial y póliza de hogar');
select pg_temp.presupuesto('Mazda CX-30 Grand Touring',  'vehiculo', 'Operación',            pg_temp.f(11), pg_temp.f(-1) - 1, 11000000, 'Combustible, parqueadero, peajes y lavado');
select pg_temp.presupuesto('Mazda CX-30 Grand Touring',  'vehiculo', 'Mantenimiento',        pg_temp.f(11), pg_temp.f(-1) - 1,  2500000, 'Preventivos programados del año');
select pg_temp.presupuesto('Café de la 70',              'negocio',  'Operación',            pg_temp.f(2),  pg_temp.f(-1) - 1, 52000000, 'Operación del trimestre en curso');
select pg_temp.presupuesto('Casa El Retiro',             'construccion', 'Obra',             pg_temp.f(8),  pg_temp.f(-6) - 1, 320000000, 'Presupuesto total de obra hasta la entrega');
select pg_temp.presupuesto('Portafolio Cripto',          'cripto',   'Compras',              pg_temp.f(11), pg_temp.f(-1) - 1, 24000000, 'Aportes previstos del año (suspendidos)');

-- ─── Cierre: ocurrencias y estados ──────────────────────────────────────────
-- Lo mismo que hace la tarea diaria de §10.1, para que la demo quede en el
-- estado en que la aplicacion la mantendria por su cuenta.

select generar_ocurrencias(12);
select marcar_vencidos();
