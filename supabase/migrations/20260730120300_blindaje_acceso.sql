-- ============================================================================
-- Blindaje de acceso — Contexto.md §6.5 y §9
--
-- El sistema es monousuario (ADR-14), asi que no hay aislamiento entre usuarios
-- que hacer cumplir: hay UNA sola coleccion de datos y un solo operador. Lo que
-- sustituye a las politicas por propietario es mas simple y mas estricto:
--
--   1. RLS activo en todas las tablas y CERO politicas. Cualquier rol que no
--      tenga BYPASSRLS no ve ni escribe una sola fila, pase lo que pase.
--   2. Los roles publicos de Supabase (anon y authenticated) se quedan sin
--      ningun permiso, ni siquiera USAGE sobre el esquema. La API REST del
--      proyecto no expone nada a quien traiga una clave publicable.
--   3. Solo service_role conserva permisos. La aplicacion se conecta con esa
--      clave desde el servidor y jamas la envia al navegador (§9).
--
-- Consecuencia a tener presente: la barrera real de acceso es el token de
-- TOKEN_ACCESO validado en el middleware, no la base de datos. Ver ADR-15.
-- ============================================================================

-- ─── 1. RLS activo y sin politicas: denegacion por omision ──────────────────

alter table ajustes                enable row level security;
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

-- ─── 2. Los roles publicos se quedan sin nada ───────────────────────────────

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke all on all routines  in schema public from anon;
    revoke usage on schema public from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables    in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke all on all routines  in schema public from authenticated;
    revoke usage on schema public from authenticated;
  end if;
end
$$;

-- Nota sobre el USAGE del esquema: aunque se revoque a anon y a authenticated,
-- PostgreSQL lo concede ademas al pseudo-rol PUBLIC, del que todo rol hereda, de
-- modo que has_schema_privilege('anon','public','usage') seguira devolviendo
-- true. No se revoca de PUBLIC porque eso afecta a roles internos de Supabase
-- (dashboard, storage, realtime) y romperia el panel. Y no hace falta: USAGE
-- sobre el esquema no concede nada sobre los objetos que contiene. La barrera son
-- los permisos por objeto, que es lo que se quita arriba y abajo.

-- PostgreSQL concede EXECUTE a PUBLIC en toda funcion. Se quita para que ninguna
-- quede invocable por un rol al que se le olvido revocar algo.
revoke execute on all routines in schema public from public;

-- Y que los objetos creados de aqui en adelante nazcan igual de cerrados. Sin
-- esta parte, la siguiente funcion o tabla que se agregue volveria a nacer
-- abierta y el blindaje se erosionaria migracion a migracion.
--
-- OJO con la ausencia de `in schema public`: el EXECUTE a PUBLIC sobre funciones
-- es un valor por omision GLOBAL de PostgreSQL, y la variante acotada a un
-- esquema no lo revoca — se ejecuta sin error y no hace nada. Solo la forma
-- global surte efecto. Hay una prueba que lo comprueba creando una funcion nueva
-- (tests/db/esquema.test.ts, "un objeto nuevo en public tampoco queda al alcance
-- de anon"), porque es la clase de detalle que se rompe en silencio.
alter default privileges revoke execute on functions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    alter default privileges in schema public revoke all on tables    from anon;
    alter default privileges in schema public revoke all on sequences from anon;
    alter default privileges in schema public revoke all on routines  from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    alter default privileges in schema public revoke all on tables    from authenticated;
    alter default privileges in schema public revoke all on sequences from authenticated;
    alter default privileges in schema public revoke all on routines  from authenticated;
  end if;
end
$$;

-- ─── 3. service_role: el unico con acceso ───────────────────────────────────

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant all on all tables    in schema public to service_role;
    grant all on all sequences in schema public to service_role;
    grant all on all routines  in schema public to service_role;

    alter default privileges in schema public grant all on tables    to service_role;
    alter default privileges in schema public grant all on sequences to service_role;
    alter default privileges in schema public grant all on routines  to service_role;
  end if;
end
$$;
