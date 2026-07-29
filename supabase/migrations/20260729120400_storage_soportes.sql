-- ============================================================================
-- Almacenamiento de soportes documentales — Contexto.md §6.7
-- Bucket privado. Lectura unicamente por URL firmada generada en el servidor.
-- Convencion de ruta: {propietario_id}/{proyecto_id}/{uuid}-{slug}
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'soportes',
  'soportes',
  false,
  10485760,   -- 10 MB (RF-42)
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- El primer segmento de la ruta debe ser el uuid del usuario autenticado.

create policy "soportes_lectura_propietario"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "soportes_carga_propietario"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "soportes_actualizacion_propietario"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "soportes_eliminacion_propietario"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'soportes' and (storage.foldername(name))[1] = auth.uid()::text);
