-- ============================================================================
-- La fecha de negocio sale de `ajustes`, no del reloj UTC del servidor
-- Contexto.md §8.5
--
-- §8.5 exige que TODO calculo de vencimientos use la zona horaria configurada en
-- `ajustes` (`America/Bogota` por omision). El dominio ya lo cumple: recibe el
-- puerto `Reloj`, que `contenedorPrivado()` construye con esa zona. La base no lo
-- cumplia: cuatro sitios usaban `current_date`, que en Supabase es UTC.
--
-- Consecuencia concreta del desfase: entre las 19:00 y la medianoche de Bogota,
-- UTC ya esta en el dia siguiente. En esas cinco horas `dias_restantes` iba
-- adelantado, una obligacion que vencia hoy se presentaba como vencida, y la
-- tarea de `marcar_vencidos` —que corre a las 05:00 COT, dentro del margen
-- seguro, pero puede dispararse a mano— podia marcar como vencido lo que aun no
-- lo estaba. Un movimiento marcado `vencido` no vuelve solo a `pendiente`.
--
-- Los cuatro sitios se corrigen juntos porque son el mismo defecto: arreglar solo
-- las dos vistas dejaria la escritura equivocada y la lectura correcta, que es
-- peor que tener las dos mal de la misma forma.
-- ============================================================================

-- ─── La fuente unica de «hoy» en la base ────────────────────────────────────
-- `stable` y no `immutable`: dentro de una misma consulta el valor no cambia,
-- pero entre consultas si. Eso permite al planificador evaluarla una sola vez por
-- consulta cuando aparece en un `where`.
--
-- No es `security definer`, por la regla de §6.6: en un sistema monousuario no
-- hay privilegios que elevar. La consecuencia es que un rol sin acceso a
-- `ajustes` recibe cero filas del subselect y cae en el `coalesce`, de modo que
-- la funcion degrada a la zona por omision en lugar de fallar.
--
-- Si `ajustes` estuviera vacia —base recien migrada, sin sembrar— el subselect
-- tambien seria null y `now() at time zone null` daria null, que envenenaria
-- cada resta de fechas en silencio. El `coalesce` es lo que lo impide.
create or replace function fecha_de_negocio()
returns date
language sql
stable
set search_path = public
as $$
  select (
    now() at time zone coalesce((select zona_horaria from ajustes), 'America/Bogota')
  )::date;
$$;

comment on function fecha_de_negocio() is
  'Contexto.md §8.5. Hoy en la zona horaria de `ajustes`. Sustituye a current_date en toda la base: current_date es UTC y adelanta un dia cinco horas cada tarde.';

-- ─── §5.3 Ventana de 12 meses para NOI y yields ─────────────────────────────

create or replace view v_metricas_12m
with (security_invoker = on) as
select
  m.proyecto_id,
  coalesce(sum(m.valor) filter (where m.tipo = 'ingreso'), 0)                          as ingresos_12m,
  coalesce(sum(m.valor) filter (where m.tipo = 'egreso' and m.naturaleza = 'opex'), 0) as gastos_operativos_12m
from movimientos m
where m.estado = 'pagado'
  and m.fecha >= (fecha_de_negocio() - interval '12 months')::date
group by 1;

comment on view v_metricas_12m is
  'Contexto.md §5.3. Ventana movil de doce meses cerrada con la fecha de negocio (§8.5), no con current_date.';

-- ─── RF-58, RF-60, RF-73 Agenda ─────────────────────────────────────────────
-- `create or replace view` conserva el orden de las columnas existentes, asi que
-- la lista del select no puede reordenarse ni recortarse. El `cross join lateral`
-- no agrega columna: solo da un nombre a la fecha de hoy para que se evalue una
-- vez por consulta y no una vez por fila.

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
  (oc.fecha_vencimiento - hoy.fecha) as dias_restantes,
  o.categoria_id,
  p.moneda
from ocurrencias_obligacion oc
join obligaciones o on o.id = oc.obligacion_id
join proyectos p    on p.id = o.proyecto_id
cross join (select fecha_de_negocio() as fecha) hoy
where oc.estado in ('pendiente', 'vencida');

comment on view v_agenda_obligaciones is
  'Contexto.md RF-58 y RF-73. Solo ocurrencias abiertas: las pagadas viven en movimientos y las omitidas no vencen. `dias_restantes` se cuenta desde la fecha de negocio (§8.5).';

-- ─── §10.1 Generacion idempotente de ocurrencias ────────────────────────────
-- El horizonte se cuenta desde la fecha de negocio. Con `current_date` el
-- horizonte se corria un dia cinco horas al dia, lo que en el borde de un mes
-- materializaba una ocurrencia de mas o de menos segun la hora de la ejecucion.

create or replace function generar_ocurrencias(p_horizonte_meses int default 12)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_obligacion  obligaciones;
  v_fecha       date;
  v_meses       int;
  v_limite      date;
  v_insertadas  int := 0;
begin
  v_limite := (fecha_de_negocio() + (p_horizonte_meses || ' months')::interval)::date;

  for v_obligacion in select * from obligaciones where activa loop
    v_meses := meses_por_frecuencia(v_obligacion.frecuencia, v_obligacion.intervalo_meses);
    v_fecha := v_obligacion.fecha_vencimiento;

    loop
      exit when v_fecha is null or v_fecha > v_limite;

      insert into ocurrencias_obligacion (obligacion_id, fecha_vencimiento, valor_estimado)
      values (v_obligacion.id, v_fecha, v_obligacion.valor_estimado)
      on conflict (obligacion_id, fecha_vencimiento) do nothing;

      if found then
        v_insertadas := v_insertadas + 1;
      end if;

      exit when v_meses = 0;   -- frecuencia unica
      v_fecha := siguiente_vencimiento(v_fecha, v_meses);
    end loop;
  end loop;

  return v_insertadas;
end;
$$;

-- ─── §10.1 Marcado de vencidos ──────────────────────────────────────────────
-- Esta es la correccion que mas importa de las cuatro: es la unica que ESCRIBE.
-- Un movimiento pasado a `vencido` antes de tiempo no vuelve solo a `pendiente`,
-- y el estado alimenta el semaforo de §5.5 y las notificaciones de §10.

create or replace function marcar_vencidos()
returns int
language plpgsql
set search_path = public
as $$
declare
  v_hoy   date := fecha_de_negocio();
  v_total int := 0;
  v_n     int;
begin
  update movimientos
     set estado = 'vencido'
   where estado = 'pendiente'
     and fecha_vencimiento is not null
     and fecha_vencimiento < v_hoy;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  update ocurrencias_obligacion
     set estado = 'vencida'
   where estado = 'pendiente'
     and fecha_vencimiento < v_hoy;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  return v_total;
end;
$$;

-- ─── Blindaje del objeto nuevo (§6.5) ───────────────────────────────────────
-- `alter default privileges` ya deberia encargarse: la migracion de blindaje
-- revoco el EXECUTE global a PUBLIC y concedio routines a service_role. Se
-- repite explicitamente porque los valores por omision solo aplican al rol que
-- los declaro, y una funcion creada por otro rol nace con las reglas de
-- PostgreSQL, no con las del proyecto. Es barato y cierra el hueco.

revoke execute on function fecha_de_negocio() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function fecha_de_negocio() from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function fecha_de_negocio() from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function fecha_de_negocio() to service_role;
  end if;
end
$$;
