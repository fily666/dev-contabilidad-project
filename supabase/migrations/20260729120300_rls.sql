-- ============================================================================
-- Seguridad a nivel de fila (RLS) — Contexto.md §6.5 y §9
-- Aislamiento total entre usuarios (RNF-11). RLS es la SEGUNDA barrera: la
-- autorizacion tambien se verifica en los casos de uso.
-- ============================================================================

alter table perfiles               enable row level security;
alter table tipos_proyecto         enable row level security;
alter table proyectos              enable row level security;
alter table categorias             enable row level security;
alter table metodos_pago           enable row level security;
alter table movimientos            enable row level security;
alter table obligaciones           enable row level security;
alter table ocurrencias_obligacion enable row level security;
alter table documentos             enable row level security;
alter table pasivos                enable row level security;
alter table valoraciones           enable row level security;
alter table presupuestos           enable row level security;
alter table notificaciones         enable row level security;
alter table registro_auditoria     enable row level security;

-- ─── perfiles: la clave del propietario es su propio id ─────────────────────

create policy perfiles_lectura      on perfiles for select using (id = auth.uid());
create policy perfiles_insercion    on perfiles for insert with check (id = auth.uid());
create policy perfiles_modificacion on perfiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ─── Catalogos compartidos: se leen los del sistema y los propios; solo se
-- ─── escriben los propios (§6.5) ────────────────────────────────────────────

create policy tipos_proyecto_lectura on tipos_proyecto
  for select using (propietario_id = auth.uid() or propietario_id is null);
create policy tipos_proyecto_insercion on tipos_proyecto
  for insert with check (propietario_id = auth.uid());
create policy tipos_proyecto_modificacion on tipos_proyecto
  for update using (propietario_id = auth.uid()) with check (propietario_id = auth.uid());
create policy tipos_proyecto_eliminacion on tipos_proyecto
  for delete using (propietario_id = auth.uid());

create policy categorias_lectura on categorias
  for select using (propietario_id = auth.uid() or propietario_id is null);
create policy categorias_insercion on categorias
  for insert with check (propietario_id = auth.uid());
-- RF-34: las categorias del sistema no se modifican ni se eliminan.
create policy categorias_modificacion on categorias
  for update using (propietario_id = auth.uid() and not es_sistema)
  with check (propietario_id = auth.uid() and not es_sistema);
create policy categorias_eliminacion on categorias
  for delete using (propietario_id = auth.uid() and not es_sistema);

-- ─── Tablas del propietario: patron unico §6.5 ──────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'proyectos','metodos_pago','movimientos','obligaciones','ocurrencias_obligacion',
    'documentos','pasivos','valoraciones','presupuestos','notificaciones'
  ]
  loop
    execute format(
      'create policy %1$s_lectura on %1$s for select using (propietario_id = auth.uid())', t);
    execute format(
      'create policy %1$s_insercion on %1$s for insert with check (propietario_id = auth.uid())', t);
    execute format(
      'create policy %1$s_modificacion on %1$s for update using (propietario_id = auth.uid()) with check (propietario_id = auth.uid())', t);
    execute format(
      'create policy %1$s_eliminacion on %1$s for delete using (propietario_id = auth.uid())', t);
  end loop;
end
$$;

-- ─── Auditoria: solo lectura para el propietario; la escritura la hace el
-- ─── trigger (security definer), que no pasa por RLS ────────────────────────

create policy auditoria_lectura on registro_auditoria
  for select using (propietario_id = auth.uid());

-- ─── Permisos base (Supabase los concede por rol; se explicitan por claridad)

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on registro_auditoria to authenticated;
revoke insert, update, delete on registro_auditoria from authenticated;
grant usage, select on all sequences in schema public to authenticated;
