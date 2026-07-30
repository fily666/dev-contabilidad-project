-- ============================================================================
-- Acentos del catálogo del sistema — Contexto.md RNF-13
--
-- El catálogo se sembró sin tildes ("Administracion", "Vehiculo", "Direccion"),
-- y esos nombres son visibles: encabezan los selectores de categoría, los
-- indicadores y los formularios dinámicos. RNF-13 exige español es-CO en toda la
-- interfaz, así que se corrigen aquí.
--
-- Lo que NO se toca, a propósito:
--   · `tipos_proyecto.codigo` y las claves de `configuracion.atributos.clave`:
--     son identificadores, no texto para leer, y se referencian desde el código.
--   · Los valores de los enumerados (`capex`, `financiacion`, …): §6.2.
--   · Las filas propias del usuario: solo se corrige lo que sembró el sistema.
--
-- `set local app.sembrando` es la única vía legítima para escribir sobre las
-- filas del sistema (§6.6): el trigger proteger_filas_de_sistema las bloquea
-- incluso para `postgres`. `local` limita el permiso a esta transacción.
--
-- Idempotente: si ya está acentuado, el `update` no encuentra filas y no hace
-- nada. Renombrar no rompe ninguna referencia: los movimientos apuntan por id.
-- ============================================================================

set local app.sembrando = 'on';

-- ─── Tipos de proyecto (RF-11) ──────────────────────────────────────────────

update tipos_proyecto set nombre = 'Vehículo'  where codigo = 'vehiculo'  and nombre = 'Vehiculo';
update tipos_proyecto set nombre = 'Inversión' where codigo = 'inversion' and nombre = 'Inversion';

-- ─── Etiquetas de los atributos dinámicos (RF-14, §13) ──────────────────────
--
-- Las etiquetas viven dentro del JSONB de configuración, así que se reescriben
-- con jsonb_set sobre cada elemento del arreglo. Se reconstruye el arreglo
-- completo porque jsonb no admite un update parcial por coincidencia de texto.

update tipos_proyecto t
set configuracion = jsonb_set(
  t.configuracion,
  '{atributos}',
  (
    select coalesce(jsonb_agg(
      case
        when a ->> 'etiqueta' = 'Direccion'              then jsonb_set(a, '{etiqueta}', '"Dirección"')
        when a ->> 'etiqueta' = 'Matricula inmobiliaria' then jsonb_set(a, '{etiqueta}', '"Matrícula inmobiliaria"')
        when a ->> 'etiqueta' = 'Area (m2)'              then jsonb_set(a, '{etiqueta}', '"Área (m²)"')
        when a ->> 'etiqueta' = 'Modelo (ano)'           then jsonb_set(a, '{etiqueta}', '"Modelo (año)"')
        when a ->> 'etiqueta' = 'Razon social'           then jsonb_set(a, '{etiqueta}', '"Razón social"')
        when a ->> 'etiqueta' = 'Linea'                  then jsonb_set(a, '{etiqueta}', '"Línea"')
        else a
      end
      order by orden
    ), '[]'::jsonb)
    from jsonb_array_elements(t.configuracion -> 'atributos') with ordinality as e(a, orden)
  )
)
where t.es_sistema
  and t.configuracion -> 'atributos' is not null
  and jsonb_typeof(t.configuracion -> 'atributos') = 'array';

-- ─── Nombres de categorías (RF-30, RF-32) ───────────────────────────────────
--
-- Se hace con una tabla de correspondencias en lugar de veinte `update` para que
-- la lista se lea de un golpe y sea fácil de auditar contra `seed.sql`.

with correcciones(sin_tilde, con_tilde) as (
  values
    ('Adecuacion de local',      'Adecuación de local'),
    ('Administracion',           'Administración'),
    ('Adquisicion',              'Adquisición'),
    ('Comision inmobiliaria',    'Comisión inmobiliaria'),
    ('Constitucion legal',       'Constitución legal'),
    ('Cuota de credito',         'Cuota de crédito'),
    ('Desembolso de credito',    'Desembolso de crédito'),
    ('Electrodomesticos',        'Electrodomésticos'),
    ('Escrituracion',            'Escrituración'),
    ('Financiacion',             'Financiación'),
    ('Inversion inicial',        'Inversión inicial'),
    ('Matricula',                'Matrícula'),
    ('Nomina',                   'Nómina'),
    ('Operacion',                'Operación'),
    ('Remodelacion',             'Remodelación'),
    ('Renovacion de documentos', 'Renovación de documentos'),
    ('Revision tecnicomecanica', 'Revisión tecnicomecánica'),
    ('Separacion',               'Separación'),
    ('Servicios publicos',       'Servicios públicos'),
    ('Valorizacion realizada',   'Valorización realizada')
)
update categorias c
set nombre = correcciones.con_tilde
from correcciones
where c.es_sistema
  and c.nombre = correcciones.sin_tilde;
