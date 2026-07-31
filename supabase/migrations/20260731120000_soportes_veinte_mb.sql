-- ============================================================================
-- Soportes de pago: limite de 20 MB por archivo — Contexto.md RF-42
--
-- El limite vive en tres capas (entidad, bucket y tabla) y las tres deben decir
-- lo mismo: si el bucket admitiera menos que el `check`, el objeto se rechazaria
-- despues de que la entidad lo dio por bueno y el usuario veria un error opaco.
-- ============================================================================

-- El `check` original venia sin nombre en el DDL inicial, asi que Postgres le
-- puso uno derivado. Se buscan por definicion y no por nombre para no depender
-- de esa convencion.
do $$
declare
  restriccion text;
begin
  for restriccion in
    select con.conname
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
     where cls.relname = 'documentos'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%tamano_bytes%'
  loop
    execute format('alter table documentos drop constraint %I', restriccion);
  end loop;
end
$$;

alter table documentos
  add constraint documentos_tamano_bytes_check
  check (tamano_bytes > 0 and tamano_bytes <= 20971520);   -- 20 MB (RF-42)

update storage.buckets
   set file_size_limit = 20971520
 where id = 'soportes';
