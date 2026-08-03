-- ============================================================================
-- El índice único de `notificaciones` no servía para el ON CONFLICT que lo usa
-- Contexto.md §10.1, §6.3
--
-- `notificaciones_unicas_idx` nació PARCIAL:
--
--     create unique index notificaciones_unicas_idx
--       on notificaciones (ocurrencia_id, canal, programada_para)
--       where ocurrencia_id is not null;
--
-- PostgreSQL solo puede inferir un índice parcial en un `on conflict (columnas)`
-- si la sentencia repite su predicado (`on conflict (...) where ocurrencia_id is
-- not null`), y PostgREST —que es quien traduce el `upsert` del adaptador— no
-- tiene forma de expresarlo: su parámetro `on_conflict` solo lleva la lista de
-- columnas. El resultado era un error 42P10, «there is no unique or exclusion
-- constraint matching the ON CONFLICT specification», en cada ejecución.
--
-- Consecuencia, que estuvo a la vista sin que nadie la leyera: **la tarea
-- `/api/cron/notificaciones` respondía 500 y no programaba ni un aviso.** La base
-- tenía 121 ocurrencias y cero notificaciones. La idempotencia que §10.1 da por
-- garantizada «por los índices únicos de §6.3» no se estaba ejerciendo, porque la
-- inserción no llegaba a ocurrir.
--
-- Por qué no lo vieron las pruebas: el doble en memoria construye la clave con un
-- centinela (`ocurrencia_id ?? "sin-ocurrencia"`), es decir, tratando los nulos
-- como IGUALES. El esquema real los trataba como distintos y encima excluía esas
-- filas del índice. El doble y la base no describían la misma regla, y el doble
-- era el que tenía razón.
-- ============================================================================

-- `nulls not distinct` es lo que el dominio quiere decir y no podía: el resumen
-- semanal de §10.3 se programa con `ocurrencia_id = null`, y su unicidad la da el
-- instante —el mismo para todo el día—. Con nulos distintos, dos ejecuciones el
-- mismo lunes insertaban dos resúmenes; con el índice parcial, ni eso, porque la
-- fila quedaba fuera del índice. Ahora la restricción cubre las dos formas de
-- aviso con una sola definición, que es la que el adaptador ya asumía.
--
-- El proyecto ya usa esta forma en `presupuestos` y en `categorias` por la misma
-- razón (§6.3): una columna opcional que forma parte de la identidad.
drop index if exists notificaciones_unicas_idx;

create unique index notificaciones_unicas_idx
  on notificaciones (ocurrencia_id, canal, programada_para)
  nulls not distinct;

comment on index notificaciones_unicas_idx is
  'Contexto.md §10.1. Idempotencia de la tarea de avisos. NO puede ser parcial: `on conflict (columnas)` no infiere un indice parcial sin repetir su predicado, y PostgREST no puede enviarlo. `nulls not distinct` cubre el resumen semanal, que va sin ocurrencia.';
