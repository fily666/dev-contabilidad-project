-- ============================================================================
-- Almacenamiento de soportes documentales — Contexto.md §6.7
--
-- Bucket privado SIN politicas: storage.objects tiene RLS activo en Supabase, de
-- modo que sin politicas ningun rol publico puede listar, leer ni subir nada.
-- La aplicacion opera el bucket con service_role desde el servidor y entrega los
-- archivos al navegador mediante URL firmada de vida corta.
--
-- Convencion de ruta: {proyecto_id}/{uuid}-{slug}
-- (antes el primer segmento era el uuid del usuario; ya no hay usuarios).
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

-- Por si el esquema anterior dejo politicas por propietario: ya no aplican,
-- porque no hay auth.uid() con el que comparar el primer segmento de la ruta.
drop policy if exists "soportes_lectura_propietario"       on storage.objects;
drop policy if exists "soportes_carga_propietario"         on storage.objects;
drop policy if exists "soportes_actualizacion_propietario" on storage.objects;
drop policy if exists "soportes_eliminacion_propietario"   on storage.objects;
