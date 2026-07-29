import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const RAIZ = join(process.cwd(), "supabase");

/**
 * Stubs de los esquemas que Supabase provee (auth y storage).
 * Permiten ejecutar las migraciones reales contra PostgreSQL embebido (PGlite),
 * sin Docker y sin depender del proyecto en la nube (Contexto.md ADR-04).
 */
const STUBS_SUPABASE = /* sql */ `
create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- En Supabase auth.uid() lee el JWT. Aqui lo simula un ajuste de sesion.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('test.usuario_actual', true), '')::uuid $$;

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

grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on auth.users to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
`;

export type BaseDePrueba = {
  db: PGlite;
  /** Ejecuta como el usuario indicado, con el rol `authenticated` y RLS activo. */
  comoUsuario<T>(usuarioId: string, fn: () => Promise<T>): Promise<T>;
  /** Crea un usuario en auth.users; el trigger crea su perfil y catalogos. */
  crearUsuario(email: string, nombre: string): Promise<string>;
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
    async comoUsuario(usuarioId, fn) {
      await db.exec(`set role authenticated; set test.usuario_actual = '${usuarioId}';`);
      try {
        return await fn();
      } finally {
        await db.exec(`reset role; reset test.usuario_actual;`);
      }
    },
    async crearUsuario(email, nombre) {
      const res = await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1::text, jsonb_build_object('nombre_completo', $2::text))
         returning id`,
        [email, nombre],
      );
      return res.rows[0]!.id;
    },
    async cerrar() {
      await db.close();
    },
  };
}
