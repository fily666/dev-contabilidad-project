-- ============================================================================
-- Bandeja de avisos in-app: la columna que faltaba para poder leerlos
-- Contexto.md §10.2, RF-59
--
-- El canal `in_app` estaba completo por el lado de la escritura: la tarea diaria
-- programa las filas y la horaria las marca `enviada` sin proveedor, porque
-- publicar un aviso in-app es solo dejarlo legible. Lo que no existia era el
-- otro lado: ninguna pantalla consultaba la tabla, y el ultimo hueco abierto de
-- §17 era precisamente ese.
--
-- Una campana necesita distinguir lo visto de lo no visto, y `estado` no puede
-- decirlo: sus cuatro valores describen el ENVIO (`programada`, `enviada`,
-- `fallida`, `cancelada`), no la lectura. Reutilizarlo —marcar `cancelada` al
-- leer, por ejemplo— habria hecho que un aviso leido fuera indistinguible de uno
-- que nunca se envio, y `cancelada` es justo el estado que la cola de §10.1
-- excluye. Son dos ejes distintos y llevan dos columnas distintas.
-- ============================================================================

alter table notificaciones
  add column if not exists leida_en timestamptz;

comment on column notificaciones.leida_en is
  'Contexto.md §10.2. Instante en que el dueño vio el aviso en la campana. Null = no leido. Eje independiente de `estado`, que describe el envio y no la lectura.';

-- Solo los avisos in-app se leen dentro de la aplicacion: el correo se lee en el
-- cliente de correo y WhatsApp en el telefono, y de esos dos la base no puede
-- saber nada. Marcar `leida_en` en ellos seria escribir un dato que nadie puede
-- verificar; la restriccion lo impide en lugar de confiar en que la aplicacion
-- se acuerde.
alter table notificaciones
  drop constraint if exists notificaciones_solo_in_app_se_lee;

alter table notificaciones
  add constraint notificaciones_solo_in_app_se_lee
  check (leida_en is null or canal = 'in_app');

-- ─── El indice de la bandeja ────────────────────────────────────────────────
-- La consulta de la campana es siempre la misma: avisos in-app cuyo instante ya
-- llego, sin las canceladas, del mas reciente al mas antiguo. Parcial y no
-- completo porque las filas de correo son la mayoria y no entran nunca en esta
-- lectura.
--
-- `estado <> 'cancelada'` en lugar de `estado = 'enviada'`: la campana muestra el
-- aviso desde que su instante se cumple, sin esperar a que la tarea horaria pase
-- a marcarlo enviado. Si esperara, un aviso programado a las 07:00 no apareceria
-- hasta la hora siguiente, y un aviso que llega tarde a quien debe reaccionar es
-- exactamente el defecto que el canal existe para evitar.
--
-- El efecto secundario es una propiedad util: `cancelarDeOcurrencia` ya cancela
-- los avisos de una ocurrencia al pagarla u omitirla (§10), asi que pagar la
-- obligacion limpia su aviso de la campana sin codigo adicional.
create index if not exists notificaciones_bandeja_idx
  on notificaciones (programada_para desc)
  include (leida_en)
  where canal = 'in_app' and estado <> 'cancelada';

comment on index notificaciones_bandeja_idx is
  'Contexto.md §10.2, RF-59. Lectura de la campana: in-app no canceladas por instante descendente. `leida_en` va incluida para que el conteo de no leidas no toque la tabla.';
