-- ============================================================================
-- Vistas de agregacion — Contexto.md §6.4
-- Definen UNA SOLA VEZ las cifras de §5.1 y §5.2. Dashboard, resumen de
-- proyecto y reportes consumen estas vistas; nunca reimplementan las formulas.
-- Regla de oro (§2): solo movimientos en estado 'pagado' alimentan las cifras
-- de caja ejecutada; los pendientes/vencidos alimentan proyeccion y alertas.
-- ============================================================================

-- ─── §5.1 Agregados base por proyecto ───────────────────────────────────────

create view v_resumen_proyecto
with (security_invoker = on) as
select
  p.id                as proyecto_id,
  p.propietario_id,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso'  and m.naturaleza = 'capex'), 0)        as total_invertido,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso'  and m.naturaleza = 'opex'), 0)         as total_gastos_operativos,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso'  and m.naturaleza = 'financiacion'), 0) as total_financiacion,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso'), 0)                                    as total_egresos,
  coalesce(sum(m.valor) filter (where m.tipo = 'ingreso'), 0)                                   as total_ingresos,
  coalesce(sum(m.valor) filter (where m.tipo = 'ingreso'), 0)
    - coalesce(sum(m.valor) filter (where m.tipo = 'egreso'), 0)                                as balance,
  coalesce(sum(m.abono_capital), 0)                                                             as abonos_a_capital,
  count(m.id)                                                                                   as movimientos_pagados,
  max(m.fecha)                                                                                  as ultimo_movimiento
from proyectos p
left join movimientos m
  on m.proyecto_id = p.id
 and m.estado = 'pagado'
group by p.id, p.propietario_id;

comment on view v_resumen_proyecto is
  'Contexto.md §5.1. total_invertido = capex pagado; los porcentuales se calculan en el dominio para poder devolver null (§5.3).';

-- ─── §5.2 Flujo de caja ejecutado ───────────────────────────────────────────

create view v_flujo_caja_mensual
with (security_invoker = on) as
select
  m.propietario_id,
  m.proyecto_id,
  date_trunc('month', m.fecha)::date                          as mes,
  coalesce(sum(m.valor) filter (where m.tipo = 'ingreso'), 0) as ingresos,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso'), 0)  as egresos,
  coalesce(sum(m.valor) filter (where m.tipo = 'ingreso'), 0)
    - coalesce(sum(m.valor) filter (where m.tipo = 'egreso'), 0) as flujo_neto
from movimientos m
where m.estado = 'pagado'
group by 1, 2, 3;

-- ─── Ultimos 12 meses, para NOI y yields (§5.3) ─────────────────────────────

create view v_metricas_12m
with (security_invoker = on) as
select
  m.propietario_id,
  m.proyecto_id,
  coalesce(sum(m.valor) filter (where m.tipo = 'ingreso'), 0)                             as ingresos_12m,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso' and m.naturaleza = 'opex'), 0)     as gastos_operativos_12m
from movimientos m
where m.estado = 'pagado'
  and m.fecha >= (current_date - interval '12 months')::date
group by 1, 2;

-- ─── Distribucion de gastos por categoria (RF-76) ───────────────────────────

create view v_gastos_por_categoria
with (security_invoker = on) as
select
  m.propietario_id,
  m.proyecto_id,
  c.id                    as categoria_id,
  coalesce(cp.nombre, c.nombre) as categoria_raiz,
  c.nombre                as categoria,
  c.naturaleza,
  sum(m.valor)            as total,
  count(*)                as cantidad
from movimientos m
join categorias c on c.id = m.categoria_id
left join categorias cp on cp.id = c.padre_id
where m.estado = 'pagado'
  and m.tipo = 'egreso'
group by 1, 2, 3, 4, 5, 6;

-- ─── Agenda: proximos vencimientos y vencidos (RF-58, RF-73) ────────────────

create view v_agenda_obligaciones
with (security_invoker = on) as
select
  o.propietario_id,
  o.proyecto_id,
  p.nombre            as proyecto,
  oc.id               as ocurrencia_id,
  o.id                as obligacion_id,
  o.concepto,
  oc.fecha_vencimiento,
  oc.valor_estimado,
  oc.estado,
  oc.movimiento_id,
  (oc.fecha_vencimiento - current_date) as dias_restantes
from ocurrencias_obligacion oc
join obligaciones o on o.id = oc.obligacion_id
join proyectos p    on p.id = o.proyecto_id
where oc.estado in ('pendiente', 'vencida');

-- ─── §5.2 Flujo proyectado (obligaciones + movimientos comprometidos) ───────

create view v_flujo_proyectado_mensual
with (security_invoker = on) as
select
  propietario_id,
  proyecto_id,
  mes,
  coalesce(sum(ingresos_esperados), 0)     as ingresos_esperados,
  coalesce(sum(egresos_estimados), 0)      as egresos_estimados,
  coalesce(sum(ingresos_esperados), 0)
    - coalesce(sum(egresos_estimados), 0)  as flujo_proyectado
from (
  -- Obligaciones futuras (siempre egresos estimados)
  select
    o.propietario_id,
    o.proyecto_id,
    date_trunc('month', oc.fecha_vencimiento)::date as mes,
    0::numeric                                      as ingresos_esperados,
    oc.valor_estimado                               as egresos_estimados
  from ocurrencias_obligacion oc
  join obligaciones o on o.id = oc.obligacion_id
  where oc.estado in ('pendiente', 'vencida')

  union all

  -- Movimientos ya registrados pero no ejecutados
  select
    m.propietario_id,
    m.proyecto_id,
    date_trunc('month', coalesce(m.fecha_vencimiento, m.fecha))::date as mes,
    case when m.tipo = 'ingreso' then m.valor else 0 end              as ingresos_esperados,
    case when m.tipo = 'egreso'  then m.valor else 0 end              as egresos_estimados
  from movimientos m
  where m.estado in ('pendiente', 'vencido')
    and m.ocurrencia_id is null   -- evita contar dos veces lo que ya viene de una ocurrencia
) fuentes
group by 1, 2, 3;

-- ─── Patrimonio por proyecto (RF-78) ────────────────────────────────────────

create view v_patrimonio_proyecto
with (security_invoker = on) as
select
  p.id           as proyecto_id,
  p.propietario_id,
  p.nombre       as proyecto,
  val.valor      as valoracion_actual,
  val.fecha      as valoracion_fecha,
  coalesce(pas.saldo_total, 0) as pasivo_total,
  coalesce(val.valor, 0) - coalesce(pas.saldo_total, 0) as patrimonio_neto
from proyectos p
left join lateral (
  select v.valor, v.fecha
  from valoraciones v
  where v.proyecto_id = p.id
  order by v.fecha desc
  limit 1
) val on true
left join lateral (
  select sum(ps.saldo_actual) as saldo_total
  from pasivos ps
  where ps.proyecto_id = p.id and ps.activo
) pas on true;
