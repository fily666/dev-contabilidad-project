-- ============================================================================
-- Vistas de las fases 2 a 4 — Contexto.md §6.4
--
-- Dos cambios, los dos por la misma razon de ADR-11: cada cifra se define una
-- sola vez en SQL y la aplicacion la consume, en lugar de reimplementar la
-- formula en TypeScript.
--
--   1. `v_agenda_obligaciones` gana `categoria_id` y `moneda`. La agenda (RF-58,
--      RF-73) y el calendario (RF-60) necesitan pintar el importe con su moneda y
--      enlazar la categoria al registrar el pago; sin estas dos columnas la
--      aplicacion tenia que volver a consultar obligaciones y proyectos para
--      completar cada fila.
--   2. `v_presupuesto_ejecucion` materializa el comparativo planeado / real /
--      desviacion de RF-81 y el porcentaje de ejecucion que dispara las alertas
--      del 80 % y el 100 % de RF-82.
-- ============================================================================

-- ─── RF-58, RF-60, RF-73 ────────────────────────────────────────────────────
-- `create or replace` conserva el orden de las columnas existentes y agrega las
-- nuevas al final, que es la unica forma en que PostgreSQL admite reemplazar una
-- vista sin borrarla.

create or replace view v_agenda_obligaciones
with (security_invoker = on) as
select
  o.proyecto_id,
  p.nombre            as proyecto,
  oc.id               as ocurrencia_id,
  o.id                as obligacion_id,
  o.concepto,
  oc.fecha_vencimiento,
  oc.valor_estimado,
  oc.estado,
  oc.movimiento_id,
  (oc.fecha_vencimiento - current_date) as dias_restantes,
  o.categoria_id,
  p.moneda
from ocurrencias_obligacion oc
join obligaciones o on o.id = oc.obligacion_id
join proyectos p    on p.id = o.proyecto_id
where oc.estado in ('pendiente', 'vencida');

comment on view v_agenda_obligaciones is
  'Contexto.md RF-58 y RF-73. Solo ocurrencias abiertas: las pagadas viven en movimientos y las omitidas no vencen.';

-- ─── RF-81, RF-82 Ejecucion presupuestal ────────────────────────────────────
-- El gasto real incluye las subcategorias de la categoria presupuestada: quien
-- presupuesta «Mantenimiento» espera que «Mantenimiento › Pintura» cuente, y la
-- alternativa —exigir un presupuesto por cada hoja— no es utilizable.
--
-- `proyecto_id is null` en el presupuesto significa presupuesto global (§6.3), y
-- entonces no se filtra por proyecto.

create view v_presupuesto_ejecucion
with (security_invoker = on) as
select
  b.id                                as presupuesto_id,
  b.proyecto_id,
  pr.nombre                           as proyecto,
  b.categoria_id,
  c.nombre                            as categoria,
  c.naturaleza,
  b.periodo_inicio,
  b.periodo_fin,
  b.valor_planeado,
  coalesce(ejecutado.total, 0)        as valor_real,
  coalesce(ejecutado.total, 0) - b.valor_planeado as desviacion,
  case
    when b.valor_planeado > 0
      then round(coalesce(ejecutado.total, 0) / b.valor_planeado, 4)
    else null
  end                                 as ejecucion,
  coalesce(ejecutado.movimientos, 0)  as movimientos
from presupuestos b
join categorias c        on c.id = b.categoria_id
left join proyectos pr   on pr.id = b.proyecto_id
left join lateral (
  select sum(m.valor) as total, count(*) as movimientos
  from movimientos m
  join categorias mc on mc.id = m.categoria_id
  where m.estado = 'pagado'
    and m.tipo   = 'egreso'
    and m.fecha between b.periodo_inicio and b.periodo_fin
    and (b.proyecto_id is null or m.proyecto_id = b.proyecto_id)
    and (mc.id = b.categoria_id or mc.padre_id = b.categoria_id)
) ejecutado on true;

comment on view v_presupuesto_ejecucion is
  'Contexto.md RF-81 y RF-82. `ejecucion` es null cuando el planeado es cero: no hay porcentaje que calcular (guarda de §5.3).';

-- ─── RF-70, RF-71, RF-75, RF-76, RF-79 Agregados con dimension temporal ─────
-- `v_resumen_proyecto` y `v_gastos_por_categoria` agregan sobre TODA la historia
-- y no admiten el selector de rango de RF-79. Estas dos vistas son las mismas
-- cifras con el mes como dimension, de modo que el panel filtre por rango sin
-- que la aplicacion tenga que recalcular nada (ADR-11).

create view v_movimientos_mensual
with (security_invoker = on) as
select
  m.proyecto_id,
  date_trunc('month', m.fecha)::date as mes,
  m.tipo,
  m.naturaleza,
  sum(m.valor)                       as total,
  count(*)                           as cantidad
from movimientos m
where m.estado = 'pagado'   -- regla de oro §2: solo lo ejecutado
group by 1, 2, 3, 4;

comment on view v_movimientos_mensual is
  'Contexto.md §5.1 con dimension temporal. Sumando por naturaleza se obtienen invertido, gasto operativo y financiacion de cualquier rango (RF-79).';

create view v_gastos_mensual_categoria
with (security_invoker = on) as
select
  m.proyecto_id,
  date_trunc('month', m.fecha)::date as mes,
  coalesce(cp.id, c.id)              as categoria_id,
  coalesce(cp.nombre, c.nombre)      as categoria_raiz,
  c.naturaleza,
  sum(m.valor)                       as total,
  count(*)                           as cantidad
from movimientos m
join categorias c        on c.id = m.categoria_id
left join categorias cp  on cp.id = c.padre_id
where m.estado = 'pagado'
  and m.tipo   = 'egreso'
group by 1, 2, 3, 4, 5;

comment on view v_gastos_mensual_categoria is
  'Contexto.md RF-75 y RF-76. Agrupa por categoria RAIZ: al dueño le interesa cuanto se fue en mantenimiento, no en cada subcategoria.';

-- Los permisos de las vistas nuevas los rige el blindaje de §6.5: service_role
-- recibe todo por `alter default privileges`, y anon/authenticated nada.
