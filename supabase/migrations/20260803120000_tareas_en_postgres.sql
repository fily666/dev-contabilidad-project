-- ============================================================================
-- Las dos tareas que ya eran SQL pasan a pg_cron
-- Contexto.md §10.1, §5.6, RF-52, RF-55
--
-- El plan Hobby de Vercel limita cada cron job a **una ejecucion al dia** con
-- una precision de una hora: un `0 10 * * *` dispara en cualquier momento entre
-- las 10:00 y las 10:59 UTC. De ahi salian dos defectos, y el primero no era un
-- retraso sino una parada:
--
--   1. `"0 * * * *"` —la tarea de envio— **fallaba el despliegue**: «Hobby
--      accounts are limited to daily cron jobs. This cron expression would run
--      more than once per day.» No corria tarde: no llegaba a existir.
--
--   2. Los tres diarios de las 10:00, 10:10 y 10:20 UTC no respetaban su orden.
--      Con precision de una hora los tres comparten ventana, asi que programar
--      avisos podia ejecutarse antes de generar las ocurrencias que los
--      motivan. El orden importaba y el plan no lo garantiza; los minutos
--      escalonados de `vercel.json` solo lo hacian parecer.
--
-- `generar_ocurrencias()` y `marcar_vencidos()` no necesitan el runtime de Next
-- para nada: son funciones SQL completas y los endpoints que las invocaban eran
-- un envoltorio de una linea sobre un caso de uso de una linea. Programadas
-- aqui corren al minuto exacto, sin limite de frecuencia, sin arranque en frio
-- y —lo que motivo el cambio— **en el orden declarado**.
--
-- En Vercel se quedan solo las dos tareas de avisos, que si necesitan el
-- runtime: las plantillas de §10.3 y el proveedor de correo viven en la
-- aplicacion, no en la base.
--
-- Los endpoints `/api/cron/obligaciones` y `/api/cron/estados` NO se borran:
-- salen de `vercel.json` y se quedan como disparadores manuales, que es lo que
-- usa el README para poblar una base recien sembrada.
-- ============================================================================

-- El `create extension` va condicionado a que la extension este disponible, y no
-- por prudencia: las pruebas de esquema corren **estas mismas migraciones**
-- contra PostgreSQL embebido (ADR-04), que no trae pg_cron. El harness apuntala
-- el esquema `cron` igual que ya apuntala `storage`, asi que las dos tareas se
-- verifican de verdad en lugar de excluir de las pruebas la migracion que las
-- declara.
--
-- La condicion no puede esconder una base mal configurada: si pg_cron faltara y
-- nadie hubiera apuntalado el esquema, la primera sentencia de mas abajo falla
-- con «schema "cron" does not exist». Lo que se salta es la instalacion, no la
-- comprobacion.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
end
$$;

-- ─── Blindaje del esquema nuevo (§6.5) ──────────────────────────────────────
-- La extension crea el esquema `cron`. No esta expuesto por PostgREST, pero el
-- proyecto cierra los objetos nuevos explicitamente en lugar de confiar en que
-- nadie los alcance (§6.5): programar tareas no es una capacidad que la
-- aplicacion deba tener por ninguna de sus tres credenciales. `service_role`
-- entra en la lista a proposito —es el rol del cliente de servidor— porque el
-- unico que debe tocar `cron.job` es el dueno de la base.

revoke all on schema cron from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema cron from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on schema cron from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on schema cron from service_role;
  end if;
end
$$;

-- ─── Las dos tareas ─────────────────────────────────────────────────────────
-- Se desprograman antes de crearlas para que la migracion sea reejecutable:
-- `cron.schedule` sustituye el trabajo del mismo nombre desde pg_cron 1.4, pero
-- la version del servidor no es algo que esta migracion controle, y un trabajo
-- duplicado no es un error visible: es la misma tarea corriendo dos veces.

select cron.unschedule(jobid)
  from cron.job
 where jobname in ('generar-ocurrencias', 'marcar-vencidos');

-- **Los horarios de pg_cron van en UTC**, igual que los de `vercel.json`
-- (§10.1). Las 09:00 UTC son las 04:00 COT.
--
-- Por que a las 04:00 y no a las 05:00 como antes: la tarea de avisos que sigue
-- en Vercel declara `0 10 * * *` y puede dispararse en cualquier minuto de esa
-- hora, incluido el 10:00 en punto. Dejar estas dos a las 09:00 y 09:05 pone
-- una hora completa de margen entre ellas y la ventana de la otra, en lugar de
-- confiar en unos minutos que el plan no respeta. Es el mismo razonamiento del
-- punto 2 de la cabecera, aplicado al limite entre las dos mitades.
--
-- Y sigue estando despues de las 05:00 UTC, que es cuando la fecha de negocio
-- cambia de dia (§8.5): a las 09:00 UTC ya son las 04:00 del dia que
-- `fecha_de_negocio()` va a devolver, asi que `marcar_vencidos()` compara
-- contra el hoy correcto. Adelantar estas tareas a las 04:00 UTC las haria
-- correr en el dia COT anterior y dejaria un dia de vencidos sin marcar.

select cron.schedule(
  'generar-ocurrencias',
  '0 9 * * *',
  $job$
    select public.generar_ocurrencias(
      coalesce(
        (select (preferencias->>'horizonte_proyeccion_meses')::int from public.ajustes),
        12
      )
    )
  $job$
);

-- Cinco minutos despues y no en el mismo trabajo: generar primero y marcar
-- despues es lo que hace que una ocurrencia recien materializada con
-- vencimiento pasado nazca `vencida` el mismo dia y no al siguiente.
select cron.schedule(
  'marcar-vencidos',
  '5 9 * * *',
  $job$ select public.marcar_vencidos() $job$
);

-- Los nombres de objeto van cualificados (`public.`) a proposito: pg_cron
-- ejecuta el comando con el `search_path` del rol que programo la tarea, no con
-- el de la sesion que corre esta migracion. Un `select generar_ocurrencias(...)`
-- a secas es la forma de que la tarea falle en produccion con «function does
-- not exist» habiendo funcionado aqui.
--
-- El horizonte se lee de `ajustes.preferencias` —la misma clave que mapea
-- `supabase-ajustes.repository.ts`— para que el valor siga teniendo una sola
-- fuente ahora que quien invoca la funcion ya no es la aplicacion.
