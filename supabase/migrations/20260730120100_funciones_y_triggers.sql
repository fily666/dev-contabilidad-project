-- ============================================================================
-- Funciones y triggers — Contexto.md §6.6
--
-- Ninguna funcion es `security definer`: en un sistema monousuario no hay
-- privilegios que elevar. La aplicacion se conecta con service_role, que ya
-- pasa por encima de RLS, y ningun rol publico puede invocarlas (§9).
-- ============================================================================

-- ─── Marca de tiempo de modificacion (RNF-08) ───────────────────────────────

create or replace function actualizar_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger ajustes_actualizado      before update on ajustes      for each row execute function actualizar_timestamp();
create trigger proyectos_actualizado    before update on proyectos    for each row execute function actualizar_timestamp();
create trigger movimientos_actualizado  before update on movimientos  for each row execute function actualizar_timestamp();
create trigger obligaciones_actualizado before update on obligaciones for each row execute function actualizar_timestamp();
create trigger pasivos_actualizado      before update on pasivos      for each row execute function actualizar_timestamp();

-- ─── Proteccion del catalogo del sistema (RF-34) ────────────────────────────
-- Antes lo garantizaba una politica RLS (`not es_sistema`). Sin usuarios no hay
-- RLS efectivo, asi que la regla pasa a ser una invariante de la base: mas
-- fuerte, porque tampoco puede saltarsela un script conectado como postgres.
-- La unica excepcion es el sembrado, que se declara explicitamente.

create or replace function proteger_filas_de_sistema()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.sembrando', true), '') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.es_sistema then
      raise exception 'FILA_DE_SISTEMA_NO_ELIMINABLE';
    end if;
    return old;
  end if;

  if old.es_sistema then
    raise exception 'FILA_DE_SISTEMA_NO_MODIFICABLE';
  end if;

  -- Tampoco se puede promover una fila propia a fila del sistema.
  if new.es_sistema then
    raise exception 'FILA_DE_SISTEMA_NO_MODIFICABLE';
  end if;

  return new;
end;
$$;

comment on function proteger_filas_de_sistema is
  'Bloquea update y delete sobre las filas sembradas (es_sistema). seed.sql se identifica con `set local app.sembrando = ''on''`.';

create trigger tipos_proyecto_proteger_sistema
  before update or delete on tipos_proyecto
  for each row execute function proteger_filas_de_sistema();

create trigger categorias_proteger_sistema
  before update or delete on categorias
  for each row execute function proteger_filas_de_sistema();

-- ─── Auditoria de creacion y modificacion (RNF-08) ──────────────────────────

create or replace function registrar_auditoria()
returns trigger
language plpgsql
as $$
declare
  v_accion     text;
  v_entidad_id uuid;
  v_cambios    jsonb;
  v_nuevo      jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_anterior   jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
begin
  -- Se opera sobre jsonb (no sobre new.<campo>) para que la funcion sirva
  -- a cualquier tabla auditada, tenga o no la columna 'estado'.
  if tg_op = 'INSERT' then
    v_accion     := 'crear';
    v_entidad_id := (v_nuevo ->> 'id')::uuid;
    v_cambios    := v_nuevo;
  elsif tg_op = 'UPDATE' then
    v_accion := case
                  when v_nuevo ->> 'estado' = 'anulado' and coalesce(v_anterior ->> 'estado', '') <> 'anulado'
                    then 'anular'
                  else 'actualizar'
                end;
    v_entidad_id := (v_nuevo ->> 'id')::uuid;

    -- Solo las claves que cambiaron
    select coalesce(
             jsonb_object_agg(k, jsonb_build_object('antes', v_anterior -> k, 'despues', v_nuevo -> k)),
             '{}'::jsonb
           )
      into v_cambios
      from jsonb_object_keys(v_nuevo) as k
     where v_nuevo -> k is distinct from v_anterior -> k
       and k <> 'actualizado_en';

    if v_cambios = '{}'::jsonb then
      return new;
    end if;
  else
    v_accion     := 'eliminar';
    v_entidad_id := (v_anterior ->> 'id')::uuid;
    v_cambios    := v_anterior;
  end if;

  insert into registro_auditoria (entidad, entidad_id, accion, cambios)
  values (tg_table_name, v_entidad_id, v_accion, v_cambios);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger proyectos_auditoria    after insert or update or delete on proyectos    for each row execute function registrar_auditoria();
create trigger movimientos_auditoria  after insert or update or delete on movimientos  for each row execute function registrar_auditoria();
create trigger obligaciones_auditoria after insert or update or delete on obligaciones for each row execute function registrar_auditoria();
create trigger documentos_auditoria   after insert or update or delete on documentos   for each row execute function registrar_auditoria();
create trigger pasivos_auditoria      after insert or update or delete on pasivos      for each row execute function registrar_auditoria();

-- ─── Coherencia: el movimiento hereda moneda y estado del proyecto ──────────

create or replace function validar_movimiento()
returns trigger
language plpgsql
as $$
declare
  v_proyecto  proyectos;
  v_categoria categorias;
begin
  select * into v_proyecto from proyectos where id = new.proyecto_id;
  if v_proyecto.id is null then
    raise exception 'PROYECTO_NO_ENCONTRADO';
  end if;

  -- Invariante §5.7.5: la moneda del movimiento es la del proyecto.
  if new.moneda <> v_proyecto.moneda then
    raise exception 'MONEDA_INCOMPATIBLE';
  end if;

  -- Invariante §5.7.7: un proyecto finalizado o archivado no acepta movimientos nuevos.
  if tg_op = 'INSERT' and v_proyecto.estado in ('finalizado','archivado') then
    raise exception 'PROYECTO_CERRADO';
  end if;

  select * into v_categoria from categorias where id = new.categoria_id;
  if v_categoria.id is null then
    raise exception 'CATEGORIA_NO_ENCONTRADA';
  end if;

  -- Invariante §5.7.3: la categoria debe ser compatible con el tipo de movimiento.
  if new.tipo = 'ingreso' and v_categoria.naturaleza not in ('ingreso','financiacion') then
    raise exception 'CATEGORIA_INCOMPATIBLE';
  end if;
  if new.tipo = 'egreso' and v_categoria.naturaleza = 'ingreso' then
    raise exception 'CATEGORIA_INCOMPATIBLE';
  end if;

  return new;
end;
$$;

create trigger movimientos_validar
  before insert or update of proyecto_id, categoria_id, tipo, moneda on movimientos
  for each row execute function validar_movimiento();

-- ─── §5.6 Calculo de la siguiente fecha de una recurrencia ──────────────────

create or replace function meses_por_frecuencia(p_frecuencia frecuencia, p_intervalo int)
returns int
language sql
immutable
as $$
  select case p_frecuencia
    when 'mensual'       then 1
    when 'bimestral'     then 2
    when 'trimestral'    then 3
    when 'semestral'     then 6
    when 'anual'         then 12
    when 'personalizada' then coalesce(p_intervalo, 1)
    else 0
  end;
$$;

-- Si el dia no existe en el mes destino (31 -> febrero) se usa el ultimo dia del mes.
create or replace function siguiente_vencimiento(p_base date, p_meses int)
returns date
language sql
immutable
as $$
  select case
    when p_meses <= 0 then null
    else least(
      (date_trunc('month', p_base) + (p_meses || ' months')::interval + (extract(day from p_base)::int - 1 || ' days')::interval)::date,
      (date_trunc('month', p_base) + (p_meses + 1 || ' months')::interval - interval '1 day')::date
    )
  end;
$$;

-- ─── §10.1 Generacion idempotente de ocurrencias ────────────────────────────

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
  v_limite := (current_date + (p_horizonte_meses || ' months')::interval)::date;

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

create or replace function marcar_vencidos()
returns int
language plpgsql
set search_path = public
as $$
declare
  v_total int := 0;
  v_n     int;
begin
  update movimientos
     set estado = 'vencido'
   where estado = 'pendiente'
     and fecha_vencimiento is not null
     and fecha_vencimiento < current_date;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  update ocurrencias_obligacion
     set estado = 'vencida'
   where estado = 'pendiente'
     and fecha_vencimiento < current_date;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  return v_total;
end;
$$;
