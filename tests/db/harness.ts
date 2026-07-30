import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const RAIZ = join(process.cwd(), "supabase");

/**
 * Stubs de lo que Supabase provee y PostgreSQL desnudo no: el esquema storage y
 * los roles anon / authenticated / service_role. Permiten ejecutar las
 * migraciones reales contra PostgreSQL embebido (PGlite), sin Docker y sin
 * depender del proyecto en la nube (Contexto.md ADR-04).
 *
 * Ya no hace falta un stub del esquema auth: el sistema es monousuario y ninguna
 * migracion menciona auth.users ni auth.uid() (ADR-14).
 */
const STUBS_SUPABASE = /* sql */ `
create schema if not exists storage;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$ select string_to_array(name, '/') $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
end $$;

-- Supabase concede estos permisos por omision a los roles publicos. Se replican
-- aqui para que la migracion de blindaje tenga algo real que revocar: si no,
-- la prueba pasaria por ausencia de permisos en lugar de por haberlos quitado.
grant usage on schema public, storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

export type BaseDePrueba = {
  db: PGlite;
  /** Ejecuta con el rol indicado (anon / authenticated), con RLS activo. */
  comoRol<T>(rol: string, fn: () => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
};

export async function crearBaseDePrueba(): Promise<BaseDePrueba> {
  const db = await PGlite.create();

  await db.exec(STUBS_SUPABASE);

  const dirMigraciones = join(RAIZ, "migrations");
  const archivos = (await readdir(dirMigraciones)).filter((f) => f.endsWith(".sql")).sort();

  for (const archivo of archivos) {
    const sql = await readFile(join(dirMigraciones, archivo), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Fallo la migracion ${archivo}: ${(error as Error).message}`);
    }
  }

  const seed = await readFile(join(RAIZ, "seed.sql"), "utf8");
  try {
    await db.exec(seed);
  } catch (error) {
    throw new Error(`Fallo el seed: ${(error as Error).message}`);
  }

  return {
    db,
    async comoRol(rol, fn) {
      await db.exec(`set role ${rol};`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role;`);
      }
    },
    async cerrar() {
      await db.close();
    },
  };
}
