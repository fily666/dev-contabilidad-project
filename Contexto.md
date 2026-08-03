# Gestor Financiero de Proyectos Personales — Especificación Técnica

> **Documento fuente de verdad del proyecto.** Toda decisión de implementación debe poder rastrearse a una sección de este archivo. Si algo no está aquí, se define aquí antes de codificarse.

**Versión:** 1.6 · **Fecha:** 2026-08-03

**Estado:** las seis fases de [§14](#14-alcance-implementado) están implementadas y cableadas
en la interfaz. `npm run verify` pasa en limpio: 488 pruebas en 35 archivos, con las once
migraciones de [§6.8](#68-migraciones) aplicadas. Lo que queda abierto —cuatro decisiones
de alcance y tres verificaciones que no se pueden hacer desde el repositorio— está en
[§17](#17-supuestos-y-pendientes-por-definir), y solo ahí.

> **Este documento describe el sistema tal como está, no cómo llegó hasta aquí.** El
> registro de las auditorías anteriores —qué se corrigió en cada revisión y por qué— vive
> en el historial de git, que es donde se puede fechar y atribuir. Aquí solo queda la
> regla que sobrevivió al hallazgo, nunca el relato de lo que estaba mal antes.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Glosario del dominio](#2-glosario-del-dominio)
3. [Escenarios de referencia](#3-escenarios-de-referencia)
4. [Requerimientos funcionales](#4-requerimientos-funcionales)
5. [Reglas de negocio y fórmulas](#5-reglas-de-negocio-y-fórmulas)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Arquitectura](#7-arquitectura)
8. [Convenciones de desarrollo](#8-convenciones-de-desarrollo)
9. [Seguridad y acceso](#9-seguridad-y-acceso)
10. [Notificaciones y tareas programadas](#10-notificaciones-y-tareas-programadas)
11. [Reportes y exportación](#11-reportes-y-exportación)
12. [Requerimientos no funcionales](#12-requerimientos-no-funcionales)
13. [Extensibilidad: agregar un tipo de proyecto](#13-extensibilidad-agregar-un-tipo-de-proyecto)
14. [Alcance implementado](#14-alcance-implementado)
15. [Entorno y configuración](#15-entorno-y-configuración)
16. [Decisiones técnicas (ADR)](#16-decisiones-técnicas-adr)
17. [Supuestos y pendientes por definir](#17-supuestos-y-pendientes-por-definir)

---

## 1. Resumen ejecutivo

### 1.1 Objetivo

Aplicación web para la **administración financiera de proyectos personales de mediano y largo plazo**. Cada proyecto es una unidad financiera independiente sobre la que se conoce, en cualquier momento: cuánto se ha invertido, cuánto genera, qué obligaciones están pendientes y cuál es su rentabilidad.

**El sistema es monousuario por diseño** ([ADR-14](#16-decisiones-técnicas-adr)): no hay cuentas, ni registro, ni perfiles de usuario. Es una instalación de una sola persona, que entra con un token de acceso configurado en el entorno. Toda la información de la base pertenece a ese único dueño.

### 1.2 Dentro del alcance

- Registro de inversión inicial, gastos recurrentes e ingresos por proyecto.
- Gestión documental de soportes (facturas, recibos, comprobantes, fotos).
- Obligaciones futuras con recurrencia, calendario financiero y notificaciones.
- Indicadores de rentabilidad, flujo de caja proyectado, presupuesto vs. real y patrimonio neto.
- Reportes filtrables exportables a PDF y Excel.

### 1.3 Fuera del alcance

- Control de gastos diarios / finanzas personales del día a día.
- Contabilidad fiscal formal (NIIF, declaración de renta, libros oficiales).
- Conciliación bancaria automática o integración con bancos (Open Banking).
- **Cuentas de usuario, registro, recuperación de contraseña y multiusuario.** El sistema es de un solo dueño ([ADR-14](#16-decisiones-técnicas-adr)).
- Multimoneda con conversión automática (v1 es monocurrency COP).

### 1.4 Criterio de éxito

El dueño puede cargar el histórico completo de un inmueble y una motocicleta, y responder sin cálculos manuales:
_¿cuánto he puesto?_, _¿cuánto me ha devuelto?_, _¿qué debo pagar este mes?_, _¿me está rindiendo?_

---

## 2. Glosario del dominio

| Término                       | Definición operativa                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proyecto**                  | Unidad financiera independiente con tipo, fechas y estado. Agrupa todos los movimientos, documentos y obligaciones.                                                                                                       |
| **Tipo de proyecto**          | Clasificación extensible (Inmueble, Vehículo, Negocio, Inversión, Otro) que determina categorías sugeridas, indicadores visibles y atributos propios.                                                                     |
| **Movimiento**                | Hecho económico fechado asociado a un proyecto: ingreso o egreso. Es el único registro que afecta cifras.                                                                                                                 |
| **Inversión (CAPEX)**         | Egreso que **incrementa el capital aportado** al activo: separación, cuota inicial, notariales, escrituración, remodelación, muebles, valor de compra, matrícula, accesorios.                                             |
| **Gasto operativo (OPEX)**    | Egreso recurrente de sostenimiento que **no capitaliza**: administración, predial, servicios, seguros, mantenimiento, combustible.                                                                                        |
| **Financiación**              | Movimiento asociado a deuda: desembolso de crédito (ingreso de financiación) y cuota de crédito (egreso de financiación, con parte capital y parte interés).                                                              |
| **Ingreso**                   | Entrada de dinero generada por el proyecto: canon de arrendamiento, otros ingresos.                                                                                                                                       |
| **Obligación / Recordatorio** | Compromiso futuro con fecha de vencimiento, valor estimado y frecuencia. Al pagarse produce un movimiento.                                                                                                                |
| **Ocurrencia**                | Instancia concreta de una obligación recurrente en una fecha específica (ej. SOAT 2027-03-14). Es lo que se ve en el calendario.                                                                                          |
| **Soporte**                   | Archivo que respalda un movimiento o pertenece al proyecto.                                                                                                                                                               |
| **Pasivo**                    | Deuda vigente del proyecto (crédito hipotecario, crédito de vehículo) con saldo, tasa y plazo.                                                                                                                            |
| **Valoración**                | Valor comercial estimado del activo en una fecha, para calcular patrimonio y plusvalía.                                                                                                                                   |
| **Estado del movimiento**     | `pendiente` (comprometido, no pagado), `pagado` (con salida/entrada real de dinero), `vencido` (pendiente con fecha de vencimiento superada), `anulado`.                                                                  |
| **Token de acceso**           | Cadena secreta configurada en `TOKEN_ACCESO` que abre la aplicación. No identifica a nadie: es la llave de la casa, no un carné. Sustituye por completo a las cuentas de usuario ([ADR-14](#16-decisiones-técnicas-adr)). |
| **Ajustes**                   | Fila única con las preferencias de la instalación (moneda y zona horaria de negocio). Ocupa el lugar del antiguo perfil de usuario, pero no describe a una persona: configura el sistema.                                 |
| **Fila del sistema**          | Registro del catálogo sembrado por `seed.sql` (`es_sistema = true`). No se puede modificar ni eliminar; solo ocultar. Lo garantiza un trigger, no una convención ([§6.6](#66-triggers)).                                  |

**Regla de oro de las cifras:** los indicadores de caja usan solo movimientos en estado `pagado`. Los movimientos `pendiente` / `vencido` alimentan proyecciones, alertas y calendario, nunca el flujo de caja ejecutado.

---

## 3. Escenarios de referencia

Estos dos escenarios son la prueba de aceptación funcional del sistema. Deben poder registrarse completos sin cambios de esquema.

### 3.1 Proyecto tipo Inmueble — "Compra de apartamento"

**Genera ingresos. Tiene pasivo. Se valoriza.**

| Concepto                  | Naturaleza   | Recurrencia               |
| ------------------------- | ------------ | ------------------------- |
| Valor de separación       | CAPEX        | única                     |
| Cuota inicial             | CAPEX        | única (o pagos parciales) |
| Gastos notariales         | CAPEX        | única                     |
| Gastos de escrituración   | CAPEX        | única                     |
| Remodelación              | CAPEX        | única / por hitos         |
| Muebles y adecuaciones    | CAPEX        | única                     |
| Administración            | OPEX         | mensual                   |
| Impuesto predial          | OPEX         | anual                     |
| Servicios públicos        | OPEX         | mensual                   |
| Cuotas extraordinarias    | OPEX         | eventual                  |
| Seguros                   | OPEX         | anual                     |
| Cuota crédito hipotecario | Financiación | mensual                   |
| Canon de arrendamiento    | Ingreso      | mensual                   |
| Otros ingresos            | Ingreso      | eventual                  |

**Indicadores exigidos:** total invertido, total de gastos, total de ingresos, flujo de caja, rentabilidad, estado financiero del proyecto.

### 3.2 Proyecto tipo Vehículo — "Compra de motocicleta"

**No genera ingresos. Se deprecia. El eje es el control de obligaciones.**

| Concepto                   | Naturaleza | Recurrencia |
| -------------------------- | ---------- | ----------- |
| Valor de compra            | CAPEX      | única       |
| Matrícula                  | CAPEX      | única       |
| Accesorios                 | CAPEX      | eventual    |
| Mantenimiento preventivo   | OPEX       | periódica   |
| Reparaciones               | OPEX       | eventual    |
| Combustible (opcional)     | OPEX       | eventual    |
| SOAT                       | OPEX       | anual       |
| Revisión técnico-mecánica  | OPEX       | anual       |
| Impuesto vehicular         | OPEX       | anual       |
| Cambio de aceite / llantas | OPEX       | periódica   |
| Renovación de documentos   | OPEX       | anual       |

**Indicadores exigidos:** costo total de propiedad (TCO), costo mensual promedio, próximas obligaciones, obligaciones vencidas. No se muestra rentabilidad (proyecto sin ingresos → ver [§5.4](#54-visibilidad-de-indicadores-por-tipo)).

---

## 4. Requerimientos funcionales

Cada requerimiento tiene ID estable (`RF-xx`), módulo y criterios de aceptación verificables. La columna **Fase** remite a [§14](#14-alcance-implementado).

### 4.1 Módulo: Acceso y ajustes

| ID    | Requerimiento                                                                                                  | Fase |
| ----- | -------------------------------------------------------------------------------------------------------------- | ---- |
| RF-01 | Ingreso con el token configurado en `TOKEN_ACCESO`. Una sola pantalla, un solo campo. Sin registro ni cuentas. | 1    |
| RF-02 | Freno a la fuerza bruta: tras 5 intentos fallidos desde el mismo origen, el acceso queda bloqueado 5 minutos.  | 1    |
| RF-03 | Ajustes editables de la instalación: moneda y zona horaria de negocio.                                         | 1    |
| RF-04 | Salir y protección de todas las rutas privadas.                                                                | 1    |

**Criterios de aceptación (RF-01/04):**

- Quien no tiene sesión y solicita `/dashboard` es redirigido a `/acceso?siguiente=/dashboard`, y tras ingresar aterriza en la ruta que pedía.
- La sesión vive en una cookie `httpOnly` firmada con HMAC-SHA256; alterar un solo carácter de la cookie la invalida.
- **Cambiar `TOKEN_ACCESO` cierra las sesiones ya abiertas**, no solo impide nuevas entradas: la clave de firma se deriva del token vigente ([§9](#9-seguridad-y-acceso)).
- El bloqueo por intentos rechaza también el token correcto mientras está activo, para no delatar el acierto con un mensaje distinto.
- La comprobación de sesión ocurre en el middleware (navegaciones) **y** en `contenedorPrivado()` (Server Actions): son dos superficies distintas y ninguna cubre a la otra.

**RF-02 con honestidad sobre su alcance:** el contador vive en memoria del proceso. En Vercel cada instancia lleva su propia cuenta, así que el freno estorba a un script simple y no a un atacante que reparta los intentos entre instancias. Lo que de verdad protege es la entropía del token; el freno es una molestia añadida, no la barrera.

### 4.2 Módulo: Proyectos

| ID    | Requerimiento                                                                                                                                             | Fase |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| RF-10 | Crear, editar, listar y archivar proyectos.                                                                                                               | 1    |
| RF-11 | Definir tipo de proyecto (Inmueble, Vehículo, Negocio, Inversión, Otro).                                                                                  | 1    |
| RF-12 | Campos: nombre, descripción, tipo, fecha de inicio, fecha de cierre, estado, moneda.                                                                      | 1    |
| RF-13 | Estados: `activo`, `pausado`, `finalizado`, `archivado`.                                                                                                  | 1    |
| RF-14 | Atributos específicos por tipo, sin cambio de esquema (dirección y matrícula inmobiliaria para inmueble; placa, marca, modelo, cilindraje para vehículo). | 1    |
| RF-15 | Vista de detalle con resumen financiero, movimientos, obligaciones y documentos del proyecto.                                                             | 1    |
| RF-16 | Registrar valoraciones del activo en el tiempo (valor comercial estimado).                                                                                | 4    |
| RF-17 | Registrar pasivos del proyecto (crédito, tasa, plazo, saldo, cuota).                                                                                      | 4    |
| RF-18 | Eliminar proyecto solo si no tiene movimientos; en caso contrario, únicamente archivar.                                                                   | 1    |

**Criterios de aceptación (RF-14):** agregar el campo "cilindraje" a proyectos de tipo Vehículo no requiere migración de base de datos ni afecta la validación de otros tipos.

### 4.3 Módulo: Movimientos financieros

| ID    | Requerimiento                                                                                                                               | Fase |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| RF-20 | Registrar movimiento con: fecha, tipo (ingreso/egreso), categoría, subcategoría, valor, método de pago, descripción, observaciones, estado. | 1    |
| RF-21 | Marcar el egreso como capitalizable (inversión) u operativo; se propone automáticamente según la categoría y es sobreescribible.            | 1    |
| RF-22 | Editar y anular movimientos. La anulación conserva el registro (nunca borrado físico) y lo excluye de las cifras.                           | 1    |
| RF-23 | Listado con filtros combinables: proyecto, rango de fechas, tipo, categoría, estado, método de pago, texto libre en descripción.            | 1    |
| RF-24 | Paginación y orden por fecha, valor o categoría.                                                                                            | 1    |
| RF-25 | Fecha de vencimiento opcional; si el estado es `pendiente` y la fecha ya pasó, el sistema lo presenta como `vencido`.                       | 2    |
| RF-26 | Marcar como pagado registrando fecha de pago y método.                                                                                      | 1    |
| RF-27 | Carga de movimientos en lote por CSV con previsualización y validación fila por fila.                                                       | 5    |
| RF-28 | Duplicar un movimiento existente como plantilla.                                                                                            | 3    |
| RF-29 | En cuotas de crédito, desglosar abono a capital e intereses.                                                                                | 4    |

**Criterios de aceptación (RF-22):** anular un movimiento pagado de $10.000.000 reduce el total invertido en exactamente ese valor y el registro sigue siendo consultable con su motivo de anulación.

### 4.4 Módulo: Categorías y catálogos

| ID    | Requerimiento                                                                                                     | Fase |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| RF-30 | Catálogo de categorías y subcategorías precargado por tipo de proyecto.                                           | 1    |
| RF-31 | El usuario puede crear, renombrar y desactivar sus propias categorías.                                            | 1    |
| RF-32 | Cada categoría declara su naturaleza: `capex`, `opex`, `ingreso`, `financiacion`.                                 | 1    |
| RF-33 | Catálogo de métodos de pago administrable (efectivo, transferencia, tarjeta de crédito, débito automático, otro). | 1    |
| RF-34 | Las categorías del sistema no se pueden eliminar; solo ocultar.                                                   | 1    |

### 4.5 Módulo: Gestión documental

| ID    | Requerimiento                                                                                                                                                                                                | Fase |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| RF-40 | Adjuntar hasta 7 soportes a un movimiento, desde el propio formulario de registro.                                                                                                                           | 2    |
| RF-41 | Adjuntar documentos a nivel de proyecto sin movimiento asociado (escritura, contrato, tarjeta de propiedad).                                                                                                 | 2    |
| RF-42 | Tipos soportados: PDF, JPG, PNG, WEBP, XLSX, DOCX. Máximo 20 MB por archivo. El comprobante de un pago admite solo PDF e imágenes.                                                                           | 2    |
| RF-43 | Metadatos por soporte: nombre del archivo, fecha de carga, tipo de documento, ruta de almacenamiento, tamaño y MIME. **Sin «quién lo cargó»:** hay un solo operador ([ADR-14](#16-decisiones-técnicas-adr)). | 2    |
| RF-44 | Previsualización en línea de imágenes y PDF.                                                                                                                                                                 | 2    |
| RF-45 | Descarga mediante URL firmada temporal; los archivos nunca son públicos.                                                                                                                                     | 2    |
| RF-46 | Eliminar soporte (borrado lógico en base de datos + borrado del objeto en Storage).                                                                                                                          | 2    |
| RF-47 | Buscar documentos por proyecto, tipo, rango de fechas y nombre.                                                                                                                                              | 3    |

**Criterios de aceptación (RF-45):** copiar la URL de un soporte y abrirla sin sesión funciona durante la vigencia de la firma (60 minutos) y falla después; la ruta directa del bucket sin firma devuelve 403.

### 4.6 Módulo: Obligaciones y recordatorios

| ID    | Requerimiento                                                                                                   | Fase |
| ----- | --------------------------------------------------------------------------------------------------------------- | ---- |
| RF-50 | Crear obligación con: proyecto, concepto, categoría, fecha de vencimiento, valor estimado, frecuencia, estado.  | 2    |
| RF-51 | Frecuencias: `unica`, `mensual`, `bimestral`, `trimestral`, `semestral`, `anual`, y personalizada cada N meses. | 2    |
| RF-52 | Generación automática de las próximas ocurrencias (horizonte configurable, por defecto 12 meses).               | 2    |
| RF-53 | Notificar N días antes del vencimiento; N configurable por obligación (por defecto 5 y 1).                      | 4    |
| RF-54 | Registrar el pago de una ocurrencia creando el movimiento asociado y precargando categoría, proyecto y valor.   | 2    |
| RF-55 | Estados de ocurrencia: `pendiente`, `pagada`, `vencida`, `omitida`.                                             | 2    |
| RF-56 | Marcar una ocurrencia como omitida sin afectar las siguientes.                                                  | 2    |
| RF-57 | Suspender o reactivar una obligación recurrente.                                                                | 2    |
| RF-58 | Vista de obligaciones vencidas y próximas a vencer (7, 30 y 90 días).                                           | 2    |
| RF-59 | Bandeja de avisos: campana con el conteo de no leídos e historial de envíos por canal.                          | 4    |

### 4.7 Módulo: Calendario financiero

| ID    | Requerimiento                                                                        | Fase |
| ----- | ------------------------------------------------------------------------------------ | ---- |
| RF-60 | Vista mensual con todas las ocurrencias y movimientos pendientes en su fecha.        | 3    |
| RF-61 | Código de color por estado (pendiente, vencido, pagado) y por tipo (ingreso/egreso). | 3    |
| RF-62 | Filtro por proyecto y por tipo de movimiento.                                        | 3    |
| RF-63 | Total comprometido del mes visible en el encabezado del calendario.                  | 3    |
| RF-64 | Clic en un evento abre el registro de pago o el detalle del movimiento.              | 3    |

### 4.8 Módulo: Dashboard

| ID    | Requerimiento                                                                                              | Fase |
| ----- | ---------------------------------------------------------------------------------------------------------- | ---- |
| RF-70 | Tarjetas globales: total invertido, total de ingresos, total de egresos, balance general.                  | 3    |
| RF-71 | Flujo de caja mensual (ejecutado) de los últimos 12 meses.                                                 | 3    |
| RF-72 | Flujo de caja proyectado de los próximos 12 meses a partir de obligaciones y recurrencias.                 | 4    |
| RF-73 | Próximos pagos (30 días) y obligaciones vencidas.                                                          | 3    |
| RF-74 | Rentabilidad por proyecto (solo proyectos con ingresos).                                                   | 3    |
| RF-75 | Evolución de gastos en el tiempo.                                                                          | 3    |
| RF-76 | Distribución de gastos por categoría.                                                                      | 3    |
| RF-77 | Resumen por proyecto: invertido, ingresos, egresos, resultado, estado.                                     | 3    |
| RF-78 | Dashboard de patrimonio: activos (valoraciones), pasivos (saldos), patrimonio neto y retorno por proyecto. | 4    |
| RF-79 | Selector de rango de fechas y de proyecto aplicable a todo el panel.                                       | 3    |

### 4.9 Módulo: Presupuestos

| ID    | Requerimiento                                                         | Fase |
| ----- | --------------------------------------------------------------------- | ---- |
| RF-80 | Definir presupuesto por proyecto, categoría y período (mes o año).    | 4    |
| RF-81 | Comparativo planificado vs. real vs. desviación (valor y porcentaje). | 4    |
| RF-82 | Alerta visual al superar el 80 % y el 100 % del presupuesto.          | 4    |
| RF-83 | Copiar el presupuesto de un período al siguiente.                     | 4    |

### 4.10 Módulo: Reportes

| ID    | Requerimiento                                                                             | Fase |
| ----- | ----------------------------------------------------------------------------------------- | ---- |
| RF-90 | Reporte de movimientos filtrable por proyecto, rango de fechas, tipo, categoría y estado. | 3    |
| RF-91 | Reporte de estado financiero por proyecto.                                                | 3    |
| RF-92 | Reporte de flujo de caja mensual.                                                         | 3    |
| RF-93 | Reporte de obligaciones (vencidas, pendientes, pagadas).                                  | 3    |
| RF-94 | Exportación a Excel (.xlsx) conservando los filtros aplicados.                            | 3    |
| RF-95 | Exportación a PDF con encabezado, filtros aplicados, totales y fecha de generación.       | 3    |

### 4.11 Módulo: Configuración

| ID     | Requerimiento                                                                               | Fase |
| ------ | ------------------------------------------------------------------------------------------- | ---- |
| RF-100 | Administrar tipos de proyecto propios, categorías y métodos de pago.                        | 3    |
| RF-101 | Preferencias: moneda, formato de fecha, tema claro/oscuro/sistema, horizonte de proyección. | 1    |

**Dónde vive cada preferencia de RF-101:** moneda y zona horaria son columnas de
`ajustes` porque el dominio las necesita para calcular ([§8.5](#85-fechas)); formato
de fecha y horizonte de proyección van en `ajustes.preferencias` (JSONB), porque son
preferencias de presentación y agregar una más no debe costar una migración. El tema
no se persiste en la base: vive en el navegador vía `next-themes`, que es lo que
evita el parpadeo del tema equivocado en la primera pintura. El horizonte alimenta
`generar_ocurrencias(p_horizonte_meses)` ([§5.6](#56-recurrencias), [§10.1](#101-tareas-vercel-cron)).
| RF-102 | Canales de notificación y días de anticipación por defecto. | 4 |
| RF-103 | Exportación completa de los datos en JSON. | 5 |

---

## 5. Reglas de negocio y fórmulas

Estas definiciones son normativas: los cálculos deben implementarse una sola vez en la capa de dominio y ser consumidos por dashboard, reportes y vistas de proyecto.

### 5.1 Agregados base por proyecto

Se consideran únicamente movimientos con `estado = pagado` y `anulado = false`.

```
total_invertido      = Σ egresos donde naturaleza = capex
total_gastos_op      = Σ egresos donde naturaleza = opex
total_financiacion   = Σ egresos donde naturaleza = financiacion   (cuotas pagadas)
total_egresos        = total_invertido + total_gastos_op + total_financiacion
total_ingresos       = Σ ingresos donde naturaleza in (ingreso, financiacion)
balance_proyecto     = total_ingresos − total_egresos
capital_aportado     = total_invertido + abonos_a_capital           (dinero propio puesto)
```

### 5.2 Flujo de caja

```
flujo_mes(m)              = ingresos_pagados(m) − egresos_pagados(m)
flujo_acumulado(m)        = Σ flujo_mes(i) para i ≤ m
flujo_proyectado_mes(m)   = ingresos_esperados(m) − obligaciones_estimadas(m)
```

`ingresos_esperados` y `obligaciones_estimadas` provienen de ocurrencias en estado `pendiente` y de movimientos `pendiente`/`vencido`.

**Cifras del mes del calendario** (`calendario/domain/mes.ts`, RF-63):

```
comprometido_mes   = Σ valor de eventos del mes en estado pendiente | vencido
vencido_mes        = Σ valor de eventos del mes ya pasados de fecha   (subconjunto del anterior)
ejecutado_mes      = Σ valor de eventos del mes en estado pagado
```

Lo vencido **no se resta** del comprometido: sigue siendo dinero que no ha salido. Se publica
aparte porque responde otra pregunta —«¿qué requiere atención?»— y se pintaba celda a celda en
la rejilla sin sumarse en ninguna parte, así que contestarla exigía contar cuadros en seis
semanas de calendario. El relleno de las semanas de los extremos no entra en ninguna de las
tres: pertenece a otro mes ([ADR-11](#16-decisiones-técnicas-adr), las cifras se definen una
sola vez en el dominio).

### 5.3 Rentabilidad

```
NOI_anual        = ingresos_12m − gastos_operativos_12m
ROI_acumulado    = (total_ingresos − total_gastos_op − total_financiacion) / total_invertido
yield_bruto      = ingresos_12m / total_invertido
yield_neto       = NOI_anual / total_invertido
cap_rate         = NOI_anual / valoracion_actual
plusvalia        = valoracion_actual − total_invertido
retorno_total    = (NOI_acumulado + plusvalia) / total_invertido
payback_meses    = primer mes donde flujo_acumulado ≥ 0
tco              = total_egresos                        (proyectos sin ingresos)
costo_mensual    = total_egresos / meses_desde_inicio
```

**Guardas obligatorias:** si `total_invertido = 0`, los indicadores porcentuales retornan `null` y la interfaz muestra `—`, nunca `0 %`, `∞` ni `NaN`. Si el proyecto tiene menos de 12 meses de vida, los indicadores anualizados se marcan como estimados y se anota el número de meses de historia.

### 5.4 Visibilidad de indicadores por tipo

| Indicador           | Inmueble | Vehículo          | Negocio  | Inversión | Otro     |
| ------------------- | -------- | ----------------- | -------- | --------- | -------- |
| Total invertido     | ✅       | ✅                | ✅       | ✅        | ✅       |
| Total ingresos      | ✅       | —                 | ✅       | ✅        | opcional |
| Flujo de caja       | ✅       | ✅                | ✅       | ✅        | ✅       |
| Yield / Cap rate    | ✅       | —                 | —        | ✅        | —        |
| ROI / Payback       | ✅       | —                 | ✅       | ✅        | opcional |
| TCO / costo mensual | opcional | ✅                | opcional | —         | opcional |
| Plusvalía           | ✅       | ✅ (depreciación) | —        | ✅        | opcional |

La visibilidad se resuelve por configuración del tipo de proyecto, no con condicionales dispersos en la interfaz.

### 5.5 Estado financiero del proyecto

Semáforo calculado:

- **Saludable:** sin obligaciones vencidas y (flujo de los últimos 3 meses ≥ 0 o proyecto sin ingresos con presupuesto cumplido).
- **En observación:** obligaciones por vencer en 7 días, o desviación de presupuesto entre 80 % y 100 %.
- **En riesgo:** al menos una obligación vencida, o presupuesto excedido, o flujo negativo sostenido 3 meses en un proyecto que debería generar ingresos.

### 5.6 Recurrencias

- La siguiente fecha se calcula sumando el intervalo a la fecha de vencimiento base.
- Si el día no existe en el mes destino (31 → febrero), se usa el último día del mes.
- Las ocurrencias se materializan con horizonte de 12 meses y se completan al ejecutarse la tarea diaria.
- Editar una obligación afecta únicamente las ocurrencias futuras en estado `pendiente`.
- Ninguna operación de generación puede duplicar ocurrencias: unicidad por `(obligacion_id, fecha_vencimiento)`.

### 5.7 Invariantes del dominio

1. Todo movimiento pertenece a exactamente un proyecto. (No hay propietario: el sistema es monousuario, [ADR-14](#16-decisiones-técnicas-adr).)
2. `valor > 0` siempre; el signo lo determina el tipo, nunca el número.
3. La categoría de un movimiento debe ser compatible con su tipo (categoría `ingreso` no admite movimiento de egreso).
4. Un movimiento `pagado` requiere `fecha_pago` y `metodo_pago`.
5. La moneda del movimiento es la del proyecto (v1 no admite mezcla).
6. Los soportes no existen sin proyecto; el vínculo al movimiento es opcional.
7. Un proyecto `finalizado` no acepta nuevos movimientos hasta ser reactivado.
8. Los montos se manejan con dos decimales y se redondean solo en la presentación.

---

## 6. Modelo de datos

PostgreSQL en Supabase. Nombres en `snake_case` singular para tablas de catálogo y plural para tablas de hechos, en español, alineados con el lenguaje del dominio.

### 6.1 Diagrama de relaciones

```
ajustes                       (fila única: preferencias de la instalación)
tipos_proyecto 1─N proyectos
proyectos 1─N movimientos ─N─1 categorias ─N─1 tipos_proyecto (opcional)
proyectos 1─N obligaciones 1─N ocurrencias_obligacion 0─1 movimientos
proyectos 1─N documentos 0─1 movimientos
proyectos 1─N pasivos
proyectos 1─N valoraciones
proyectos 1─N presupuestos ─N─1 categorias
movimientos ─N─1 metodos_pago
ocurrencias_obligacion 1─N notificaciones
* 1─N registro_auditoria
```

No hay `auth.users` ni `perfiles`, y ninguna tabla tiene `propietario_id`: **el proyecto es la raíz del grafo**. Eso simplifica cada consulta (una condición menos), cada índice y cada invariante, y elimina la clase entera de errores «se me olvidó filtrar por propietario».

### 6.2 Tipos enumerados

```sql
create type estado_proyecto      as enum ('activo','pausado','finalizado','archivado');
create type tipo_movimiento      as enum ('ingreso','egreso');
create type naturaleza_categoria as enum ('capex','opex','ingreso','financiacion');
create type estado_movimiento    as enum ('pendiente','pagado','vencido','anulado');
create type frecuencia           as enum ('unica','mensual','bimestral','trimestral','semestral','anual','personalizada');
create type estado_ocurrencia    as enum ('pendiente','pagada','vencida','omitida');
create type tipo_documento       as enum ('factura','recibo','comprobante','contrato','escritura','fotografia','poliza','otro');
create type tipo_pasivo          as enum ('credito_hipotecario','credito_vehiculo','credito_libre','tarjeta_credito','otro');
create type canal_notificacion   as enum ('email','whatsapp','in_app');
create type estado_notificacion  as enum ('programada','enviada','fallida','cancelada');
```

### 6.3 Esquema

El DDL ejecutable vive en `supabase/migrations/20260730120000_esquema_inicial.sql`; lo que sigue es el mismo esquema con las anotaciones de diseño, **ya con las migraciones posteriores aplicadas** ([§6.8](#68-migraciones)) — por eso el `check` de `tamano_bytes` dice 20 MB aquí y 10 MB en el archivo inicial. Si difieren, manda el estado acumulado de las migraciones: `npm run db:verify-types` contrasta además los tipos de TypeScript contra la base real.

**Ninguna tabla tiene `propietario_id`, `creado_por` ni `actualizado_por`.** El sistema es monousuario ([ADR-14](#16-decisiones-técnicas-adr)): no hay a quién atribuir las filas ni de quién aislarlas.

```sql
-- Preferencias de la instalación. Sustituye a la antigua tabla de perfiles: no
-- describe a una persona, configura el sistema. El check sobre la clave primaria
-- booleana es lo que garantiza que exista a lo sumo UNA fila.
create table ajustes (
  id             boolean primary key default true check (id),
  moneda         char(3) not null default 'COP',
  zona_horaria   text    not null default 'America/Bogota',
  preferencias   jsonb   not null default '{}'::jsonb,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Catálogo extensible de tipos de proyecto (sistema + propios)
create table tipos_proyecto (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,          -- inmueble, vehiculo, negocio, inversion, otro
  nombre        text not null,
  icono         text,
  -- Define atributos propios e indicadores visibles sin migraciones:
  -- { "atributos": [{ "clave":"placa","etiqueta":"Placa","tipo":"text","requerido":true }],
  --   "indicadores": ["total_invertido","tco","costo_mensual"] }
  configuracion jsonb not null default '{}'::jsonb,
  -- Distinción explícita entre fila del sistema y fila propia, protegida
  -- por un trigger (§6.6).
  es_sistema    boolean not null default false,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table proyectos (
  id               uuid primary key default gen_random_uuid(),
  tipo_proyecto_id uuid not null references tipos_proyecto(id),
  nombre           text not null check (length(trim(nombre)) between 1 and 120),
  descripcion      text,
  fecha_inicio     date not null,
  fecha_fin        date,
  estado           estado_proyecto not null default 'activo',
  moneda           char(3) not null default 'COP',
  atributos        jsonb not null default '{}'::jsonb,   -- validados contra tipos_proyecto.configuracion
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint fechas_coherentes check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index proyectos_estado_idx on proyectos (estado);
create index proyectos_tipo_idx on proyectos (tipo_proyecto_id);

create table categorias (
  id               uuid primary key default gen_random_uuid(),
  tipo_proyecto_id uuid references tipos_proyecto(id),               -- null = aplica a todos
  padre_id         uuid references categorias(id) on delete cascade, -- null = categoría raíz
  nombre           text not null check (length(trim(nombre)) between 1 and 80),
  naturaleza       naturaleza_categoria not null,
  es_sistema       boolean not null default false,
  activa           boolean not null default true,
  orden            int not null default 0,
  creado_en        timestamptz not null default now()
);

create index categorias_busqueda_idx on categorias (tipo_proyecto_id, naturaleza);
create index categorias_padre_idx on categorias (padre_id);

-- Un solo índice para todo el catálogo. `nulls not distinct` hace que las raíces
-- (padre_id null) y las transversales (tipo_proyecto_id null) también colisionen,
-- que es lo que permite sembrar de forma idempotente (§6.8).
create unique index categorias_unicas_idx
  on categorias (tipo_proyecto_id, padre_id, nombre) nulls not distinct;

create table metodos_pago (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(trim(nombre)) between 1 and 60),
  tipo            text not null default 'otro'
    check (tipo in ('efectivo','transferencia','tarjeta_credito','tarjeta_debito','debito_automatico','otro')),
  ultimos_digitos text check (ultimos_digitos ~ '^[0-9]{2,4}$'),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  constraint metodos_pago_nombre_unico unique (nombre)
);

-- Tabla central: el único registro que mueve las cifras.
create table movimientos (
  id                uuid primary key default gen_random_uuid(),
  proyecto_id       uuid not null references proyectos(id) on delete restrict,
  categoria_id      uuid not null references categorias(id),
  metodo_pago_id    uuid references metodos_pago(id),
  tipo              tipo_movimiento not null,
  naturaleza        naturaleza_categoria not null,   -- se propone desde la categoría, es sobreescribible (RF-21)
  fecha             date not null,                   -- fecha del hecho económico
  fecha_vencimiento date,                            -- para pendientes
  fecha_pago        date,                            -- obligatoria si estado = pagado
  valor             numeric(18,2) not null check (valor > 0),
  moneda            char(3) not null default 'COP',
  abono_capital     numeric(18,2) check (abono_capital >= 0),   -- desglose de cuota de crédito (RF-29)
  abono_interes     numeric(18,2) check (abono_interes >= 0),
  descripcion       text not null check (length(trim(descripcion)) between 1 and 200),
  observaciones     text,
  estado            estado_movimiento not null default 'pendiente',
  motivo_anulacion  text,
  ocurrencia_id     uuid,                            -- FK diferida a ocurrencias_obligacion
  metadatos         jsonb not null default '{}'::jsonb,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint pagado_requiere_fecha check (estado <> 'pagado' or fecha_pago is not null),
  constraint anulado_requiere_motivo check (estado <> 'anulado' or motivo_anulacion is not null),
  constraint desglose_credito check (
    (abono_capital is null and abono_interes is null)
    or (abono_capital is not null and abono_interes is not null and abono_capital + abono_interes = valor)
  ),
  -- Invariante §5.7.3 en la base, no solo en el dominio
  constraint naturaleza_coherente check (
    (tipo = 'ingreso' and naturaleza in ('ingreso','financiacion'))
    or (tipo = 'egreso' and naturaleza in ('capex','opex','financiacion'))
  )
);

create index movimientos_proyecto_fecha_idx on movimientos (proyecto_id, fecha desc);
create index movimientos_vencimiento_idx on movimientos (estado, fecha_vencimiento);
create index movimientos_categoria_idx on movimientos (categoria_id);
create index movimientos_fecha_idx on movimientos (fecha desc);
create index movimientos_descripcion_idx on movimientos using gin (to_tsvector('spanish', descripcion));

create table obligaciones (
  id                    uuid primary key default gen_random_uuid(),
  proyecto_id           uuid not null references proyectos(id) on delete cascade,
  categoria_id          uuid not null references categorias(id),
  concepto              text not null check (length(trim(concepto)) between 1 and 150),
  valor_estimado        numeric(18,2) not null check (valor_estimado >= 0),
  fecha_vencimiento     date not null,   -- primera ocurrencia
  frecuencia            frecuencia not null,
  intervalo_meses       int check (intervalo_meses > 0),
  dias_aviso            int[] not null default '{5,1}',
  crear_movimiento_auto boolean not null default false,
  activa                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  constraint intervalo_personalizado check (frecuencia <> 'personalizada' or intervalo_meses is not null)
);

create index obligaciones_activas_idx on obligaciones (activa);
create index obligaciones_proyecto_idx on obligaciones (proyecto_id);

create table ocurrencias_obligacion (
  id                uuid primary key default gen_random_uuid(),
  obligacion_id     uuid not null references obligaciones(id) on delete cascade,
  fecha_vencimiento date not null,
  valor_estimado    numeric(18,2) not null check (valor_estimado >= 0),
  estado            estado_ocurrencia not null default 'pendiente',
  movimiento_id     uuid references movimientos(id) on delete set null,
  creado_en         timestamptz not null default now(),
  -- Idempotencia de la tarea diaria (§5.6, §10.1)
  constraint ocurrencia_unica unique (obligacion_id, fecha_vencimiento)
);

create index ocurrencias_agenda_idx on ocurrencias_obligacion (estado, fecha_vencimiento);

alter table movimientos
  add constraint movimientos_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias_obligacion(id) on delete set null;

create table documentos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid not null references proyectos(id) on delete cascade,
  movimiento_id  uuid references movimientos(id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage   text not null unique,   -- {proyecto_id}/{uuid}-{slug}  (§6.7)
  tipo_documento tipo_documento not null default 'otro',
  mime_type      text not null,
  tamano_bytes   bigint not null check (tamano_bytes > 0 and tamano_bytes <= 20971520),
  cargado_en     timestamptz not null default now(),
  eliminado_en   timestamptz             -- borrado lógico
);

create index documentos_proyecto_idx on documentos (proyecto_id) where eliminado_en is null;
create index documentos_movimiento_idx on documentos (movimiento_id) where eliminado_en is null;

create table pasivos (
  id               uuid primary key default gen_random_uuid(),
  proyecto_id      uuid not null references proyectos(id) on delete cascade,
  nombre           text not null,
  tipo             tipo_pasivo not null,
  monto_original   numeric(18,2) not null check (monto_original > 0),
  saldo_actual     numeric(18,2) not null check (saldo_actual >= 0),
  tasa_interes_ea  numeric(6,4) check (tasa_interes_ea >= 0),
  plazo_meses      int check (plazo_meses > 0),
  valor_cuota      numeric(18,2) check (valor_cuota > 0),
  fecha_desembolso date not null,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create index pasivos_proyecto_idx on pasivos (proyecto_id) where activo;

create table valoraciones (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  fecha       date not null,
  valor       numeric(18,2) not null check (valor >= 0),
  fuente      text,
  notas       text,
  creado_en   timestamptz not null default now(),
  constraint valoracion_unica unique (proyecto_id, fecha)
);

create table presupuestos (
  id             uuid primary key default gen_random_uuid(),
  proyecto_id    uuid references proyectos(id) on delete cascade,   -- null = presupuesto global
  categoria_id   uuid not null references categorias(id),
  periodo_inicio date not null,
  periodo_fin    date not null,
  valor_planeado numeric(18,2) not null check (valor_planeado >= 0),
  notas          text,
  creado_en      timestamptz not null default now(),
  constraint periodo_valido check (periodo_fin >= periodo_inicio),
  constraint presupuesto_unico unique nulls not distinct
    (proyecto_id, categoria_id, periodo_inicio, periodo_fin)
);

create table notificaciones (
  id              uuid primary key default gen_random_uuid(),
  ocurrencia_id   uuid references ocurrencias_obligacion(id) on delete cascade,
  canal           canal_notificacion not null,
  asunto          text not null,
  cuerpo          text not null,
  programada_para timestamptz not null,
  enviada_en      timestamptz,
  estado          estado_notificacion not null default 'programada',
  error           text,
  intentos        int not null default 0 check (intentos >= 0),
  -- §10.2, RF-59. Eje independiente de `estado`: ese describe el envío y este la
  -- lectura. Solo el canal in-app se lee dentro de la aplicación; un correo se lee
  -- en el cliente de correo y anotarlo aquí sería inventar un dato.
  leida_en        timestamptz,
  constraint notificaciones_solo_in_app_se_lee
    check (leida_en is null or canal = 'in_app')
);

create index notificaciones_cola_idx on notificaciones (estado, programada_para);
-- Idempotencia del job de notificaciones (§10.1).
--
-- `nulls not distinct` y NO parcial. Nació con `where ocurrencia_id is not null` y
-- eso lo hacía inservible para el `on conflict (columnas)` que lo usa: PostgreSQL
-- no infiere un índice parcial si la sentencia no repite su predicado, y PostgREST
-- solo sabe enviar la lista de columnas. La tarea diaria respondía 42P10 y no
-- programaba ni un aviso (§10.1).
create unique index notificaciones_unicas_idx
  on notificaciones (ocurrencia_id, canal, programada_para)
  nulls not distinct;
-- Lectura de la campana (§10.2): in-app no canceladas, por instante descendente.
-- `estado <> 'cancelada'` y no `estado = 'enviada'` a propósito: ver §10.2.
create index notificaciones_bandeja_idx
  on notificaciones (programada_para desc)
  include (leida_en)
  where canal = 'in_app' and estado <> 'cancelada';

-- Rastro de cambios. Sin actor: hay un solo operador, así que la pregunta que
-- responde es "qué cambió y cuándo", no "quién lo cambió".
create table registro_auditoria (
  id          bigserial primary key,
  entidad     text not null,
  entidad_id  uuid not null,
  accion      text not null check (accion in ('crear','actualizar','anular','eliminar')),
  cambios     jsonb,
  ocurrido_en timestamptz not null default now()
);

create index auditoria_entidad_idx on registro_auditoria (entidad, entidad_id, ocurrido_en desc);
create index auditoria_reciente_idx on registro_auditoria (ocurrido_en desc);
```

### 6.4 Vistas de agregación

Los cálculos de [§5.1](#51-agregados-base-por-proyecto) se exponen como vistas para evitar duplicar SQL en la aplicación:

```sql
create view v_resumen_proyecto
with (security_invoker = on) as
select
  p.id as proyecto_id,
  coalesce(sum(m.valor) filter (where m.tipo='egreso'  and m.naturaleza='capex'), 0)        as total_invertido,
  coalesce(sum(m.valor) filter (where m.tipo='egreso'  and m.naturaleza='opex'), 0)         as total_gastos_operativos,
  coalesce(sum(m.valor) filter (where m.tipo='egreso'  and m.naturaleza='financiacion'), 0) as total_financiacion,
  coalesce(sum(m.valor) filter (where m.tipo='ingreso'), 0)                                 as total_ingresos,
  coalesce(sum(m.valor) filter (where m.tipo='ingreso'), 0)
    - coalesce(sum(m.valor) filter (where m.tipo='egreso'), 0)                              as balance,
  max(m.fecha) as ultimo_movimiento
from proyectos p
left join movimientos m
  on m.proyecto_id = p.id and m.estado = 'pagado'
group by p.id;

create view v_flujo_caja_mensual
with (security_invoker = on) as
select
  m.proyecto_id,
  date_trunc('month', m.fecha)::date as mes,
  coalesce(sum(m.valor) filter (where m.tipo='ingreso'), 0) as ingresos,
  coalesce(sum(m.valor) filter (where m.tipo='egreso'),  0) as egresos,
  coalesce(sum(m.valor) filter (where m.tipo='ingreso'), 0)
    - coalesce(sum(m.valor) filter (where m.tipo='egreso'), 0) as flujo_neto
from movimientos m
where m.estado = 'pagado'
group by 1, 2;
```

Arriba están las dos vistas fundacionales. El juego completo son **diez**, repartidas en tres migraciones:

| Vista                        | Alimenta                                                 | Migración           |
| ---------------------------- | -------------------------------------------------------- | ------------------- |
| `v_resumen_proyecto`         | [§5.1](#51-agregados-base-por-proyecto), RF-15, RF-77    | `…120200`           |
| `v_flujo_caja_mensual`       | RF-71 (por proyecto), RF-92                              | `…120200`           |
| `v_metricas_12m`             | [§5.3](#53-rentabilidad) (ventana de 12 meses)           | `…120200`/`…130000` |
| `v_gastos_por_categoria`     | **sin consumidor**, ver abajo                            | `…120200`           |
| `v_agenda_obligaciones`      | RF-58, RF-73 (redefinida en `…140000` y en `…130000`)    | `…120200`           |
| `v_flujo_proyectado_mensual` | RF-72                                                    | `…120200`           |
| `v_patrimonio_proyecto`      | RF-78                                                    | `…120200`           |
| `v_presupuesto_ejecucion`    | RF-81, RF-82                                             | `…140000`           |
| `v_movimientos_mensual`      | RF-70, RF-71, RF-74, RF-75, RF-77 (todo el panel, RF-79) | `…140000`           |
| `v_gastos_mensual_categoria` | RF-76                                                    | `…140000`           |

Las diez se crean con `security_invoker = on`. Aunque ya no haya usuarios que aislar, la opción garantiza que una vista nunca conceda más acceso que quien la consulta, de modo que agregar una política en el futuro no abra un hueco por la puerta de atrás.

**`v_gastos_por_categoria` no la consume nadie**, y conviene que quede escrito en lugar de
que se descubra dentro de un año. Nació para RF-76, pero agrega sobre toda la historia y no
admite el rango de RF-79; `v_gastos_mensual_categoria` la sustituyó en `…140000` y la
original se quedó sin llamador. Se conserva por ahora porque retirarla cuesta una migración
y no estorba, pero **no es una definición mantenida**: si RF-76 cambia de fórmula, cambia en
`v_gastos_mensual_categoria`. Lo mismo, en menor grado, con `v_flujo_caja_mensual`: su único
consumidor es el resumen de un proyecto; el panel se alimenta de `v_movimientos_mensual`.

**Todas las cifras del panel salen de `v_movimientos_mensual`, también las de cada
proyecto.** Es lo que permite que el rango de RF-79 se aplique de verdad a la pantalla
completa. Mientras las tarjetas de RF-77 y la tabla de RF-74 se sirvieron de
`v_resumen_proyecto`, el dashboard mostraba cifras del rango y cifras históricas juntas, con
las mismas etiquetas y sin distinguirlas. `v_resumen_proyecto` sigue siendo la vista correcta
donde no hay rango: el listado de `/proyectos` y el detalle de un proyecto.

**El rango se aplica con granularidad de mes**, porque estas vistas agregan por mes: el
adaptador lleva `desde` y `hasta` al día 1 antes de consultar. Por eso el selector del panel
es de mes y no de día — dos campos de día prometían una precisión que la consulta no tiene.

Los porcentuales **no** se calculan aquí: van en el dominio, porque necesitan devolver `null` cuando el divisor es cero ([§5.3](#53-rentabilidad)) y SQL no distinguiría ese caso de un cero legítimo.

### 6.5 Blindaje de acceso a la base

No hay usuarios que aislar entre sí, así que las políticas por propietario no tienen nada que hacer cumplir. Se sustituyen por algo más simple y más estricto:

1. **RLS habilitado en las catorce tablas y CERO políticas.** Cualquier rol sin `BYPASSRLS` no ve ni escribe una sola fila, pase lo que pase.
2. **Los roles públicos de Supabase (`anon`, `authenticated`) se quedan sin ningún permiso.** La API REST del proyecto no expone nada a quien traiga una clave publicable.
3. **Solo `service_role` conserva acceso.** La aplicación se conecta con esa clave desde el servidor y jamás la envía al navegador ([§9](#9-seguridad-y-acceso)).

```sql
alter table <tabla> enable row level security;   -- y ninguna política

revoke all   on all tables in schema public from anon, authenticated;
revoke usage on schema public                 from anon, authenticated;
revoke execute on all routines in schema public from public;

-- Para que los objetos futuros nazcan igual de cerrados
alter default privileges revoke execute on functions from public;   -- OJO: sin "in schema"
alter default privileges in schema public revoke all on tables from anon, authenticated;
```

Dos detalles que se rompen en silencio y por eso están cubiertos por pruebas:

- **`alter default privileges ... in schema public revoke execute on functions from public` no hace nada.** El `EXECUTE` a `PUBLIC` sobre funciones es un valor por omisión _global_ de PostgreSQL; solo la variante sin `in schema` lo revoca. La acotada se ejecuta sin error y deja la puerta abierta.
- **`anon` sigue teniendo `USAGE` sobre el esquema** aunque se le revoque, porque PostgreSQL también se lo concede al pseudo-rol `PUBLIC`, del que todo rol hereda. No se revoca de `PUBLIC` porque rompería el panel de Supabase, y no hace falta: `USAGE` sobre el esquema no concede nada sobre los objetos que contiene.

Lo que hay que vigilar tras cada migración es que no aparezcan permisos nuevos: `npm run db:inspect` lo comprueba y falla si los encuentra.

### 6.6 Triggers

- `actualizar_timestamp()`: mantiene `actualizado_en` en cada `update`.
- `registrar_auditoria()`: inserta en `registro_auditoria` en `insert/update/delete` de `proyectos`, `movimientos`, `obligaciones`, `documentos`, `pasivos`. Opera sobre `to_jsonb(new)` en lugar de `new.<campo>` para servir a tablas con y sin columna `estado`.
- `proteger_filas_de_sistema()`: rechaza `update` y `delete` sobre las filas sembradas de `tipos_proyecto` y `categorias`, y también impide promover una fila propia a fila del sistema (RF-34). **Es un trigger y no una política RLS a propósito:** sin RLS efectivo una política no protegería nada, y el trigger es además más fuerte, porque tampoco puede saltárselo un script conectado como `postgres`. La única excepción es el sembrado, que se declara con `set app.sembrando = 'on'` en `seed.sql`.
- `validar_movimiento()`: valida moneda, estado del proyecto y compatibilidad de la categoría (§5.7).
- Ninguna función es `security definer`: en un sistema monousuario no hay privilegios que elevar, y así se evita una superficie de escalada innecesaria.

### 6.7 Almacenamiento (Supabase Storage)

- Bucket único **privado**: `soportes`, límite de 20 MB y lista blanca de MIME.
- Convención de ruta: `{proyecto_id}/{uuid}-{slug-nombre-archivo}`.
- **Sin políticas de Storage.** `storage.objects` tiene RLS activo en Supabase, así que sin políticas ningún rol público puede listar, leer ni subir. La aplicación opera el bucket con `service_role` desde el servidor.
- Acceso de lectura exclusivamente por URL firmada con vigencia de 60 minutos, generada en el servidor.
- Validación de MIME y tamaño antes de subir (cliente) y al registrar el documento (servidor).
- Borrado: primero se marca `eliminado_en`, luego se elimina el objeto; si falla el borrado en Storage se registra para reintento y el documento queda oculto.
- Los soportes **no se borran por SQL**: Supabase lo impide con el trigger `storage.protect_delete`, y hace bien, porque eliminar la fila no elimina el archivo y lo dejaría huérfano. Se eliminan por la API de Storage.

### 6.8 Migraciones

- Carpeta `supabase/migrations/`, archivos `YYYYMMDDHHMMSS_descripcion.sql`, versionados y aplicados con Supabase CLI. Las aplicadas hoy son once:

  | Migración                                    | Qué introduce                                                                                                                    |
  | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
  | `20260730120000_esquema_inicial`             | Enumerados, catorce tablas, índices y restricciones ([§6.3](#63-esquema))                                                        |
  | `20260730120100_funciones_y_triggers`        | Los cinco triggers de [§6.6](#66-triggers) y `generar_ocurrencias`                                                               |
  | `20260730120200_vistas_agregacion`           | Las siete primeras vistas de [§6.4](#64-vistas-de-agregación)                                                                    |
  | `20260730120300_blindaje_acceso`             | RLS en las catorce tablas y cierre a los roles públicos ([§6.5](#65-blindaje-de-acceso-a-la-base))                               |
  | `20260730120400_storage_soportes`            | Bucket privado `soportes` ([§6.7](#67-almacenamiento-supabase-storage))                                                          |
  | `20260730130000_acentos_del_catalogo`        | Tildes del catálogo sembrado (RNF-13)                                                                                            |
  | `20260730140000_vistas_agenda_y_presupuesto` | Las tres vistas restantes y la redefinición de `v_agenda_obligaciones`                                                           |
  | `20260731120000_soportes_veinte_mb`          | Sube el límite por archivo de 10 a 20 MB (RF-42)                                                                                 |
  | `20260731130000_fecha_de_negocio`            | `fecha_de_negocio()` y el fin de `current_date` en la base ([§8.5](#85-fechas))                                                  |
  | `20260731140000_bandeja_de_avisos`           | `notificaciones.leida_en`, su restricción de canal y el índice de la campana ([§10.2](#102-canales))                             |
  | `20260731150000_avisos_idempotentes`         | `notificaciones_unicas_idx` deja de ser parcial: sin eso la tarea de avisos fallaba con 42P10 ([§10.1](#101-tareas-vercel-cron)) |

- **El límite de tamaño de un soporte vive en tres capas y las tres deben decir lo mismo:** la entidad (`documento.entity.ts`), el `check` de `documentos.tamano_bytes` y el `file_size_limit` del bucket. La última migración las movió juntas por eso: si el bucket admitiera menos que el `check`, el objeto se rechazaría después de que la entidad lo dio por bueno y el usuario vería un error opaco. La migración busca el `check` original **por su definición y no por su nombre**, porque el DDL inicial lo declaró sin nombrar y Postgres le puso uno derivado.
- Nunca se edita una migración ya aplicada: se crea una nueva. **Única excepción admitida hasta ahora:** el paso a monousuario ([ADR-14](#16-decisiones-técnicas-adr)) reescribió el juego completo de migraciones en lugar de encadenar cuatro migraciones de deshacer. Se hizo porque la base no tenía ningún dato, las migraciones originales llevaban horas aplicadas y el esquema anterior queda en el historial de git. La regla vuelve a estar en vigor: de aquí en adelante, migración nueva.
- Datos semilla (ajustes, tipos de proyecto, categorías del sistema y métodos de pago) en `supabase/seed.sql`, idempotentes.
- **`supabase/demo.sql` no es semilla, es material de desarrollo.** Siembra cinco proyectos con dos años de historia para que el dashboard, el flujo proyectado y los presupuestos tengan cifras con las que trabajar. Se aplica solo con `npm run db:demo` ([§15.3](#153-scripts)), nunca con `db:seed`, y se niega a correr si ya hay datos propios: mezclar datos de demostración con datos reales es irreversible sin distinguirlos.
- **Corregir un texto ya sembrado exige migración, no editar el seed.** El seed inserta con `on conflict do nothing` / `do update` sobre `(tipo_proyecto_id, padre_id, nombre)`: cambiar un `nombre` allí no renombra la fila existente, la duplica. Así se hizo con `20260730130000_acentos_del_catalogo.sql`, que puso las tildes que faltaban en el catálogo (RNF-13) con `set local app.sembrando = 'on'` —única vía legítima para escribir sobre las filas del sistema ([§6.6](#66-triggers))— y además se actualizó el seed para que una instalación nueva nazca correcta.
- **`supabase db push --include-seed` no reejecuta una semilla cuyo hash ya conoce:** informa «hash update» y sigue, dejando un esquema recién creado y vacío sin ningún error a la vista. Por eso `scripts/reiniciar-base.mjs` borra también `supabase_migrations.seed_files`.
- Los tipos TypeScript de `src/shared/infrastructure/supabase/database.types.ts` están escritos a mano, pero **verificados**: `npm run db:verify-types` contrasta cada columna y su nulabilidad contra la base real. Ejecutarlo después de cada migración.

---

## 7. Arquitectura

### 7.1 Principios

Arquitectura hexagonal (puertos y adaptadores) con casos de uso independientes y principios SOLID.

1. **El dominio no conoce nada externo.** Sin imports de Next.js, Supabase, React ni librerías de infraestructura.
2. **La aplicación depende del dominio mediante interfaces (puertos).** Nunca de implementaciones concretas.
3. **La infraestructura implementa puertos.** Es la única capa que conoce Supabase, Storage, correo o generación de PDF.
4. **La presentación (Next.js) solo invoca casos de uso**, resueltos por un contenedor de dependencias. Ningún componente ni Server Action consulta Supabase directamente.
5. **Dirección de dependencias:** `presentación → aplicación → dominio ← infraestructura`.

### 7.2 Estructura de carpetas

```
src/
├── app/                                  # Next.js App Router — solo presentación
│   ├── (auth)/acceso/                    # única pantalla pública: el token
│   ├── (privado)/
│   │   ├── layout.tsx                    # shell: sidebar, topbar, guardia de sesión
│   │   ├── dashboard/
│   │   ├── proyectos/[id]/(secciones)/            # layout con cabecera + pestañas
│   │   │   └── (movimientos|obligaciones|documentos|patrimonio)/
│   │   ├── movimientos/(importar)/         # RF-27 carga en lote
│   │   ├── obligaciones/
│   │   ├── calendario/
│   │   ├── avisos/                        # RF-59: historial de avisos por canal (§10.2)
│   │   ├── documentos/
│   │   ├── presupuestos/
│   │   ├── patrimonio/
│   │   ├── reportes/
│   │   └── configuracion/                # catálogos + preferencias (§4.11)
│   ├── api/
│   │   ├── cron/(obligaciones|notificaciones|estados)/route.ts
│   │   ├── cron/autorizacion.ts        # guardia compartida (§10.1)
│   │   └── exportar/
│   │       ├── [formato]/route.ts      # RF-94, RF-95: xlsx | pdf en una sola ruta
│   │       └── datos/route.ts          # RF-103: exportación completa en JSON
│   ├── layout.tsx
│   └── globals.css
│
├── modules/                              # un contexto acotado por carpeta
│   ├── proyectos/                         # módulo de referencia: así se ve uno completo
│   │   ├── domain/
│   │   │   ├── proyecto.entity.ts         # entidad + invariantes
│   │   │   ├── proyecto.repository.ts     # PUERTO (interface)
│   │   │   ├── tipo-proyecto.entity.ts
│   │   │   ├── tipo-proyecto.repository.ts
│   │   │   └── indicadores.ts             # fórmulas de §5.3 y semáforo de §5.5
│   │   ├── application/
│   │   │   ├── crear-proyecto.use-case.ts
│   │   │   ├── actualizar-proyecto.use-case.ts
│   │   │   ├── listar-proyectos.use-case.ts
│   │   │   ├── obtener-proyecto.use-case.ts
│   │   │   ├── obtener-resumen-proyecto.use-case.ts
│   │   │   ├── cambiar-estado-proyecto.use-case.ts   # archivar/pausar/finalizar (RF-13)
│   │   │   ├── eliminar-proyecto.use-case.ts         # RF-18: solo sin movimientos
│   │   │   ├── (listar|administrar)-tipos-proyecto.use-case.ts
│   │   │   └── dobles.ts                  # repositorios en memoria para pruebas (§8.8)
│   │   ├── infrastructure/
│   │   │   ├── supabase-proyecto.repository.ts   # ADAPTADOR
│   │   │   ├── supabase-tipo-proyecto.repository.ts
│   │   │   └── proyecto.mapper.ts
│   │   └── presentation/
│   │       ├── components/
│   │       ├── actions.ts                 # Server Actions → casos de uso
│   │       └── schemas.ts                 # Zod (formulario y payload)
│   ├── movimientos/
│   ├── categorias/
│   ├── metodos-pago/
│   ├── documentos/
│   ├── obligaciones/
│   ├── presupuestos/
│   ├── patrimonio/
│   ├── notificaciones/                     # con presentation/ desde RF-59: campana y tabla
│   ├── reportes/
│   ├── dashboard/
│   ├── calendario/
│   └── acceso/                            # token, sesión firmada y ajustes
│
├── shared/
│   ├── domain/                            # Dinero, Reloj, Resultado, enumeraciones, errores base
│   ├── infrastructure/
│   │   ├── supabase/(cliente-servidor|entorno|database.types).ts
│   │   ├── storage/supabase-almacenamiento.ts
│   │   ├── email/resend.ts
│   │   ├── export/(excel.ts|pdf.tsx)
│   │   └── reloj-del-sistema.ts
│   ├── presentation/                      # ejecutarAccion: envoltura de Server Actions
│   ├── testing/reloj-fijo.ts              # el Reloj determinista de las pruebas
│   ├── ui/                                # shadcn/ui + componentes propios
│   │   ├── cabeceras.tsx                  # CabeceraPagina (h1) y CabeceraSeccion (h2)
│   │   ├── panel-datos.tsx                # marco único de los paneles con título
│   │   └── viz/                           # capa de gráficas en SVG (§8.1)
│   └── utils/                             # cn, formato de moneda y fechas, etiquetas es-CO
│
├── di/
│   └── container.ts                       # fábricas de casos de uso por request
│
└── middleware.ts                          # verifica la cookie firmada y protege rutas
```

**Notas de implementación:**

- **No hay un `<modulo>.errors.ts` por módulo.** Los errores de dominio son tres clases en `shared/domain/errores.ts` (`NoEncontrado`, `NoAutorizado`, `ReglaDeNegocioViolada`) que llevan un código estable, y la presentación lo traduce con `MENSAJE_ERROR` de `shared/utils/etiquetas.ts` ([§8.6](#86-errores-y-resultados)). Un archivo de errores por módulo habría multiplicado por trece la misma jerarquía sin añadir ni una regla.
- **`presentation/leer-filtros.ts`** aparece en `movimientos`, `documentos`, `dashboard` y `reportes`: es la contrapartida de haber puesto el estado de lectura en la URL ([§7.6](#76-estrategia-de-renderizado)). Traduce `searchParams` a la entrada del caso de uso, aplicando los valores por omisión y descartando lo que no valide, para que una URL manipulada a mano no llegue nunca al dominio.
- Los métodos de pago viven en su propio módulo (`metodos-pago/`) aunque comparten pantalla de configuración con las categorías: son dos catálogos con ciclos de vida distintos.
- Las reglas de frontera de §7.1 están codificadas como reglas `no-restricted-imports` en `eslint.config.mjs`: violarlas rompe el lint, no solo la convención.
- Los componentes de `shared/ui` provienen de shadcn/ui sobre **Base UI**, que compone con la prop `render` en lugar de `asChild`. Para enlaces con apariencia de botón se usa el helper `EnlaceBoton`.
- **Tres primitivos de composición, y ninguna vista escribe su propio armazón:** `CabeceraPagina` (el `h1` con ámbito, descripción y acciones), `CabeceraSeccion` (el `h2` en versalitas) y `PanelDatos` (el marco de todo bloque con título propio, del que `PanelGrafica` es la especialización con leyenda). **Una sola gramática por nivel:** ninguna vista escribe su propio `h1`, su propio `h2` ni su propio marco de panel, y el `Card` de shadcn no se usa como marco de panel de datos. La raíz de toda página es `space-y-6`, sin excepciones, para que el ritmo vertical no cambie al navegar.
- **`metodos-pago/` tiene las cuatro capas, aunque comparta pantalla con las categorías.** Nació con solo `domain/` e `infrastructure/`, y la consecuencia fue que las Server Actions llamaban al repositorio y la regla «no eliminar un método en uso» vivía en la acción, justo donde §7.4 dice que no debe estar. Es el ejemplo de por qué la frontera se codifica en el lint y no en la costumbre.
- **El contenedor expone casos de uso, nunca repositorios ni el cliente de Supabase.** Alcanzar `contenedor.<modulo>.repositorio` desde una página salta la capa de aplicación sin que ningún `import` lo delate; por eso hay además una regla `no-restricted-syntax` que lo prohíbe.
- Hay un solo cliente de Supabase (`cliente-servidor.ts`) y usa `service_role`. Lleva `import "server-only"`, así que si un componente con `"use client"` lo importara, **la compilación falla** en vez de enviar la clave al navegador. No hay `cliente-navegador.ts` ni `admin.ts`: sin clave anónima no hay cliente de navegador que escribir, y sin RLS el acceso administrativo no es un caso especial.
- `acceso/domain/sesion-firmada.ts` **no importa nada**, a propósito: solo usa Web Crypto y globales de codificación. Así el middleware —que corre en Edge y no puede cargar `node:crypto`— reutiliza exactamente la misma verificación que el servidor, sin riesgo de que dos implementaciones divergan.

### 7.3 Puertos definidos

| Puerto                                      | Responsabilidad                                                 | Adaptador v1                                                      |
| ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ProyectoRepository`                        | Persistencia de proyectos y sus cifras agregadas                | Supabase (PostgREST)                                              |
| `TipoProyectoRepository`                    | Catálogo de tipos de proyecto (RF-100, RNF-10)                  | Supabase                                                          |
| `MovimientoRepository`                      | Persistencia y consulta filtrada de movimientos                 | Supabase                                                          |
| `CategoriaRepository`                       | Catálogo de categorías                                          | Supabase                                                          |
| `MetodoPagoRepository`                      | Catálogo de métodos de pago (RF-33)                             | Supabase                                                          |
| `ObligacionRepository`                      | Obligaciones y ocurrencias                                      | Supabase                                                          |
| `DocumentoRepository`                       | Metadatos de soportes                                           | Supabase                                                          |
| `PresupuestoRepository`                     | Presupuestos por período                                        | Supabase                                                          |
| `PasivoRepository` / `ValoracionRepository` | Patrimonio                                                      | Supabase                                                          |
| `DashboardRepository`                       | Lecturas agregadas del panel ([§6.4](#64-vistas-de-agregación)) | Supabase (vistas)                                                 |
| `NotificacionRepository`                    | Cola de avisos programados y enviados                           | Supabase                                                          |
| `AlmacenamientoArchivos`                    | Subir, firmar URL, eliminar                                     | Supabase Storage                                                  |
| `NotificadorEmail`                          | Envío de correo                                                 | Resend (API REST, sin SDK)                                        |
| `NotificadorWhatsApp`                       | Envío de WhatsApp                                               | **sin adaptador** ([§17](#17-supuestos-y-pendientes-por-definir)) |
| `GeneradorExcel`                            | Exportación .xlsx                                               | ExcelJS                                                           |
| `GeneradorPdf`                              | Exportación .pdf                                                | @react-pdf/renderer                                               |
| `Reloj`                                     | Fecha/hora actual (testeable)                                   | sistema · `reloj-fijo` en pruebas                                 |
| `CredencialAcceso`                          | Token y secreto de sesión configurados                          | variables de entorno                                              |
| `AlmacenSesion`                             | Leer, escribir y borrar la sesión del navegador                 | cookie `httpOnly` de Next                                         |
| `AjustesRepository`                         | Preferencias de la instalación (fila única `ajustes`)           | Supabase                                                          |

**No hay puerto `ServicioAuditoria`, y es deliberado.** La auditoría de RNF-08 la
escribe por completo el trigger `registrar_auditoria()` ([§6.6](#66-triggers)): una
interfaz en el dominio para algo que la base hace sola sería ceremonia que además se
podría olvidar de invocar. La contrapartida es que `registro_auditoria` hoy solo se
escribe, no se lee: no existe pantalla de historial.

### 7.4 Anatomía de un caso de uso

Firma uniforme, una responsabilidad, dependencias por constructor:

```ts
// modules/movimientos/application/registrar-movimiento.use-case.ts
export class RegistrarMovimiento {
  constructor(
    private readonly movimientos: MovimientoRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(input: RegistrarMovimientoInput): Promise<Movimiento> {
    const proyecto = await this.proyectos.buscarPorId(input.proyectoId);
    if (!proyecto) throw new ProyectoNoEncontrado(input.proyectoId);
    if (!proyecto.aceptaMovimientos()) throw new ProyectoCerrado(proyecto.id);

    const categoria = await this.categorias.buscarPorId(input.categoriaId);
    if (!categoria) throw new CategoriaNoEncontrada(input.categoriaId);

    const movimiento = Movimiento.crear({
      ...input,
      categoria,
      moneda: proyecto.moneda,
      ahora: this.reloj.ahora(),
    });
    return this.movimientos.guardar(movimiento);
  }
}
```

Las reglas (compatibilidad tipo/categoría, `valor > 0`, pagado exige fecha) viven en `Movimiento.crear`, no en el caso de uso ni en la interfaz.

### 7.5 Flujo de una operación de escritura

```
Formulario (React Hook Form + Zod)
  → Server Action  (valida con el mismo esquema Zod)
    → contenedorPrivado()  (exige sesión vigente, §9.2)
      → Caso de uso  (orquesta)
        → Entidad de dominio  (aplica invariantes)
        → Repositorio (puerto)  →  Adaptador Supabase  →  PostgreSQL
                                    (checks, triggers; RLS activo sin políticas, §6.5)
  ← Resultado  →  revalidatePath  →  toast (sonner)
```

### 7.6 Estrategia de renderizado

- **Server Components** por defecto: listados, detalle de proyecto, dashboard, reportes.
- **Client Components** solo donde hay interacción: formularios, filtros, calendario, gráficas, subida de archivos.
- **Server Actions** para toda mutación; API Routes reservadas para cron, exportaciones y webhooks.
- Datos de lectura interactiva (filtros, orden, paginación) **en los parámetros de la URL**, resueltos por el servidor en cada navegación. No hay caché de cliente ni hidratación de estado: los filtros quedan compartibles (RNF-09) y no hay dos copias de la verdad que sincronizar. TanStack Query se retiró después de comprobar que el proveedor llevaba montado sin un solo consumidor; si aparece una lectura que de verdad necesite refresco en vivo (una cola de notificaciones, por ejemplo), vuelve para ese caso y no para todo.
- `revalidatePath` / `revalidateTag` tras cada mutación exitosa.

---

## 8. Convenciones de desarrollo

### 8.1 Stack

| Capa               | Tecnología                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Framework          | Next.js 15 (App Router, React 19)                                                                 |
| Lenguaje           | TypeScript en modo `strict`                                                                       |
| Estilos            | Tailwind CSS 4                                                                                    |
| Componentes        | shadcn/ui sobre **Base UI** (`@base-ui/react`), no Radix ([§7.2](#72-estructura-de-carpetas))     |
| Formularios        | React Hook Form                                                                                   |
| Validación         | Zod (compartida cliente/servidor)                                                                 |
| Estado de servidor | Server Components + parámetros de URL (sin TanStack Query, [§7.6](#76-estrategia-de-renderizado)) |
| Gráficas           | **Capa propia en `shared/ui/viz/`** (SVG + CSS), sin Recharts                                     |
| Tablas             | Tabla propia en `shared/ui/table.tsx` (el orden y la paginación son del servidor)                 |
| Fechas             | date-fns (locale `es`)                                                                            |
| Base de datos      | Supabase (PostgreSQL)                                                                             |
| Archivos           | Supabase Storage                                                                                  |
| Acceso             | Token en variable de entorno + cookie firmada con HMAC-SHA256 (Web Crypto)                        |
| Correo             | Resend por API REST, sin SDK (`shared/infrastructure/email/resend.ts`)                            |
| Excel / PDF        | ExcelJS / @react-pdf/renderer (adaptadores en `shared/infrastructure/export/`)                    |
| Pruebas            | Vitest + Testing Library + Playwright                                                             |
| Calidad            | ESLint, Prettier, Husky, lint-staged                                                              |
| Despliegue         | Vercel (app) + Supabase (datos y archivos)                                                        |

**Por qué Base UI y no Radix:** shadcn/ui migró a Base UI, que compone con la prop
`render` en lugar de `asChild`. La consecuencia práctica está anotada en
[§7.2](#72-estructura-de-carpetas): para enlaces con apariencia de botón se usa el
helper `EnlaceBoton`, y los `Select` no son `<select>` nativos, lo que cambia cómo
se los localiza en las pruebas.

**Por qué una capa de gráficas propia:** las visualizaciones de v1 son medidores,
barras y una serie de flujo. Recharts añade ~90 kB de JavaScript de cliente para
eso, y obliga a marcar como `"use client"` páginas que hoy son Server Components.
`shared/ui/viz/` las dibuja con SVG y CSS desde el servidor. Si aparece una gráfica
genuinamente interactiva (zoom, tooltip con cruz, pincel de rango), se reevalúa.

### 8.2 Restricciones tecnológicas

- **Prohibido Docker.** Desarrollo local contra Supabase en la nube o Supabase CLI sin contenedores.
- **Prohibido Prisma.** Acceso a datos exclusivamente con `@supabase/supabase-js` y SQL en migraciones.
- Sin ORMs adicionales ni librerías de estado global (Redux, Zustand) ni caché de cliente (TanStack Query) mientras los Server Components y los parámetros de URL sean suficientes: hoy lo son ([§7.6](#76-estrategia-de-renderizado)).
- **Sin Supabase Auth ni `@supabase/ssr`.** El sistema es monousuario y entra por token ([ADR-14](#16-decisiones-técnicas-adr)): no hay sesión de Supabase que refrescar.

### 8.3 Nomenclatura

| Elemento              | Convención                | Ejemplo                            |
| --------------------- | ------------------------- | ---------------------------------- |
| Carpetas y archivos   | `kebab-case`              | `registrar-movimiento.use-case.ts` |
| Componentes React     | `PascalCase`              | `TarjetaResumenProyecto.tsx`       |
| Clases y tipos        | `PascalCase`              | `MovimientoRepository`             |
| Funciones y variables | `camelCase`               | `calcularFlujoMensual`             |
| Constantes            | `SCREAMING_SNAKE_CASE`    | `HORIZONTE_PROYECCION_MESES`       |
| Tablas y columnas SQL | `snake_case` en español   | `ocurrencias_obligacion`           |
| Rutas                 | español, `kebab-case`     | `/proyectos/[id]/obligaciones`     |
| Casos de uso          | verbo infinitivo + sufijo | `ArchivarProyecto`                 |
| Server Actions        | verbo + `Action`          | `registrarMovimientoAction`        |

Sufijos obligatorios cuando el archivo describe **una** cosa: `.entity.ts`, `.repository.ts` (puerto), `.use-case.ts`, `.mapper.ts`.

Los nombres fijos por capa, en cambio, no llevan sufijo porque no hay más de uno por módulo: `actions.ts` (Server Actions), `schemas.ts` (Zod), `leer-filtros.ts` (URL → entrada del caso de uso) y `dobles.ts` (repositorios en memoria). **No hay archivos `.dto.ts`:** las entradas y salidas de los casos de uso son tipos declarados junto al caso de uso que los usa, y sacarlos a un archivo aparte solo alejaba el tipo de su única razón de existir.

Cuando un módulo tiene varios casos de uso pequeños que se leen juntos —`categorias`, `obligaciones`, `presupuestos`, `patrimonio`, `notificaciones`, `metodos-pago`, `reportes`, `acceso`, `documentos`— viven en un solo `application/casos-de-uso.ts`. Se reserva un archivo `.use-case.ts` por caso a los módulos donde cada uno tiene peso propio: `movimientos` y `proyectos`.

### 8.4 Manejo de dinero

- Almacenamiento: `numeric(18,2)`.
- En TypeScript, un value object `Dinero` que encapsula monto y moneda; jamás aritmética con `number` sueltos ni floats acumulados.
- Presentación: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`, en `shared/utils/formato.ts`.
- **Entrada: campo de texto con `inputMode="decimal"`, sin máscara que reescriba mientras se teclea.** Lo que normaliza es `aNumero()`, dentro del `transform` del esquema Zod: acepta `1.250.000`, `1250000,50` y `$ 1.250.000`, y descarta el punto solo cuando separa grupos de tres dígitos, para no confundir el separador de miles con el decimal. Una máscara que reformatea en cada pulsación pelea con el cursor y con React Hook Form; normalizar al validar da el mismo resultado sin ese conflicto.
- Esa normalización es **una sola función compartida** por los cuatro esquemas que reciben importes (movimientos, obligaciones, presupuestos, patrimonio). Estuvo copiada en siete sitios, que eran siete lugares donde arreglar el mismo caso raro.

### 8.5 Fechas

- Fechas de negocio (fecha del movimiento, vencimiento) como `date` sin hora, para evitar corrimientos de zona.
- Marcas de tiempo de auditoría como `timestamptz` en UTC.
- Todo cálculo de vencimientos usa la zona horaria de `ajustes` (`America/Bogota` por defecto). No hay perfil: la zona configura la instalación, no a una persona ([§2](#2-glosario-del-dominio), [ADR-14](#16-decisiones-técnicas-adr)).
- El dominio nunca llama a `new Date()`: recibe el puerto `Reloj`. `contenedorPrivado()` lo construye ya ajustado a esa zona, y las pruebas inyectan `reloj-fijo`, que es lo que hace verificables los vencimientos y las recurrencias.
- **La base tampoco llama a `current_date`.** Esa regla la cumplía el dominio y la incumplía
  la base: `current_date` en Supabase es UTC, y entre las 19:00 y la medianoche de Bogotá ya
  está en el día siguiente. En esas cinco horas `v_agenda_obligaciones` daba `dias_restantes`
  adelantado —una obligación que vencía hoy se presentaba como vencida—, la ventana de
  `v_metricas_12m` se corría un día, y `marcar_vencidos()` podía escribir `vencido` sobre algo
  que aún no lo estaba. Lo último es lo grave: un movimiento marcado `vencido` no vuelve solo
  a `pendiente`. La función `fecha_de_negocio()` es ahora la única fuente de «hoy» en la base;
  es `stable`, no es `security definer` ([§6.6](#66-triggers)) y degrada a `America/Bogota` si
  `ajustes` está vacía o fuera de alcance, de modo que nunca devuelve `null` y envenena una
  resta de fechas en silencio.
- Las pruebas de este punto comparan dos zonas separadas **veinticinco** horas
  (`Pacific/Kiritimati` y `Pacific/Niue`), que nunca comparten fecha del calendario. Una
  prueba ingenua contra `America/Bogota` habría pasado diecinueve horas al día.

### 8.6 Errores y resultados

- Errores de dominio como clases con código estable (`PROYECTO_NO_ENCONTRADO`, `CATEGORIA_INCOMPATIBLE`), traducidos a mensajes en español en la presentación.
- Server Actions retornan `{ ok: true, data }` o `{ ok: false, codigo, mensaje, camposConError? }`; nunca lanzan excepciones al cliente.
- Errores inesperados: se registran en el servidor y el usuario recibe un mensaje genérico con identificador de incidente.

### 8.7 Validación

- Un esquema Zod por operación, en `presentation/schemas.ts`, reutilizado por el formulario y la Server Action (RNF-07: validación en cliente y servidor con la misma fuente).
- La base de datos es la última línea de defensa: `check`, `not null`, `unique`, claves foráneas y los triggers de [§6.6](#66-triggers) —`validar_movimiento()` y `proteger_filas_de_sistema()` rechazan lo que el dominio dejara pasar—. **RLS no cuenta como validación:** está activo pero sin políticas, así que no comprueba datos; lo que hace es cerrar la base a los roles públicos ([§6.5](#65-blindaje-de-acceso-a-la-base)).

### 8.8 Pruebas

| Nivel            | Alcance                                                                                                                                      | Cobertura objetivo            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Unitarias        | Entidades, value objects, cálculos de [§5](#5-reglas-de-negocio-y-fórmulas), recurrencias                                                    | ≥ 90 % en `domain/`           |
| Casos de uso     | Con repositorios en memoria (`<modulo>/application/dobles.ts`)                                                                               | todos los casos de uso        |
| Esquema          | Migraciones y seed reales contra PostgreSQL embebido (PGlite): restricciones, triggers, vistas, recurrencias, Storage y blindaje de permisos | esquema completo              |
| Humo remoto      | Las comprobaciones críticas contra el Supabase real (`npm run db:smoke`)                                                                     | cifras, invariantes, blindaje |
| E2E (Playwright) | Los dos escenarios de [§3](#3-escenarios-de-referencia) de punta a punta, el acceso y el RNF-01 a 375 px                                     | flujos críticos               |

`npm run test` cubre los tres primeros niveles: **488 pruebas en 35 archivos**, en unos ocho
segundos. `npm run test:e2e` corre aparte: **23 pruebas en 6 archivos** —los dos proyectos de
navegador— en minuto y medio, porque necesita navegador y el Supabase de desarrollo.

**El ≥ 90 % es un objetivo, no una puerta.** `vitest.config.ts` declara el reporte de
cobertura y qué mide (`modules/*/domain`, `modules/*/application`, `shared/domain`), pero
no hay umbral configurado, ni script `test:coverage`, ni la dependencia `@vitest/coverage-v8`
instalada: hoy esa cifra no se mide en cada corrida. Lo bloqueante es RNF-14 —tipos y
lint— en CI. Convertir el 90 % en umbral es un pendiente abierto (P-4 en
[§17.2](#172-decisiones-de-alcance-pendientes)); mientras no se cierre, la columna de la
tabla es una intención y no un dato verificado.

**Pruebas de seguridad obligatorias.** Sin usuarios no hay aislamiento entre ellos que probar,
así que lo que se verifica es el cierre:

- `anon` y `authenticated` no pueden leer ni escribir ninguna tabla, ni consultar las vistas, ni invocar las funciones.
- **Un objeto creado después de las migraciones tampoco queda a su alcance.** Esta es la que importa a largo plazo: verifica que `alter default privileges` surtió efecto y que el blindaje no se erosiona con la próxima migración.
- Las filas del catálogo del sistema no se pueden modificar ni eliminar, ni se puede promover una fila propia a fila del sistema.
- Rotar el token invalida la sesión en curso, y el bloqueo por intentos rechaza también el token correcto.

**Nivel de esquema (`tests/db/`):** dado que Docker está descartado (ADR-04), las pruebas de base de datos no usan `supabase start`. En su lugar, un harness levanta PostgreSQL embebido con [PGlite](https://pglite.dev), simula el esquema `storage` y los roles `anon` / `authenticated` / `service_role` de Supabase, ejecuta las migraciones y el seed tal como están en el repositorio y verifica el comportamiento real. Corre en segundos, sin contenedores ni credenciales.

El harness **concede a los roles públicos los permisos que Supabase les da por omisión** antes de aplicar las migraciones. Sin eso, las pruebas de blindaje pasarían por ausencia de permisos en lugar de por haberlos quitado, que no es lo mismo.

**Lo que PGlite no cubre:** todo lo que vive fuera del esquema `public` en el Supabase real — los triggers de `storage`, el historial de migraciones de la CLI, el pooler. Por eso existe `npm run db:smoke`, y por eso una migración no se da por buena hasta haberlo corrido: hay defectos de esa clase que solo aparecen ahí.

**Nivel E2E (`tests/e2e/`):** Playwright contra el proyecto Supabase de desarrollo
([§15.4](#154-entornos)), porque sin Docker no hay base local. De ahí tres decisiones:

- **Los E2E crean sus propios proyectos con el prefijo `[e2e]`** y un
  `globalTeardown` los borra por SQL al terminar. Nunca tocan datos reales. Se borran
  por SQL y no por la interfaz porque RF-18 impide eliminar un proyecto con
  movimientos y anular no borra la fila: por diseño el sistema no ofrece un camino de
  borrado total, y hace bien ([ADR-12](#16-decisiones-técnicas-adr)).
- **Sin paralelismo** (`workers: 1`): comparten una sola base y en paralelo se
  pisarían los totales que verifican.
- **Un proyecto de navegador a 375 px** que comprueba RNF-01 en las rutas del shell.

Los `Select` son de Base UI, no `<select>` nativos: el disparador es un `combobox` y
las opciones se montan en un `listbox` flotante fuera del contenedor. Los helpers de
`tests/e2e/utils/acciones.ts` encapsulan eso y el hecho de que los campos
obligatorios llevan un asterisco dentro del `<label>`, así que el nombre accesible es
«Valor \*» y no «Valor».

### 8.9 Git

- Ramas: `main` (producción), `develop`, `feat/*`, `fix/*`, `chore/*`.
- Commits con Conventional Commits en español: `feat(movimientos): registrar egreso capitalizable`.
- Pre-commit: ESLint + Prettier + `tsc --noEmit`. Pre-push: pruebas unitarias.

---

## 9. Seguridad y acceso

### 9.1 Cómo se entra

- **Un token, sin cuentas.** El valor de `TOKEN_ACCESO` abre la aplicación. No identifica a nadie ni se guarda en la base: se compara con lo que llega y punto.
- La comparación es **de digestos, no de cadenas**: se compara `SHA-256(esperado)` con `SHA-256(recibido)` en tiempo constante, de modo que el tiempo de respuesta no revele cuántos caracteres iniciales acertó quien lo intenta, ni la longitud del token real.
- La sesión es una cookie `httpOnly` + `secure` (en producción) + `sameSite=lax`, con valor `<expiración>.<HMAC-SHA256>` y vigencia de 30 días. No lleva dentro ningún dato: solo su propia fecha de caducidad, firmada.
- **La clave de firma se deriva del secreto de sesión y del digesto del token vigente.** Consecuencia deliberada: cambiar `TOKEN_ACCESO` invalida al instante todas las cookies emitidas antes. Rotar el token cierra las sesiones abiertas, que es lo que uno espera de una rotación.
- La firma se verifica **antes** de interpretar la carga: nunca se lee una expiración que no se haya demostrado auténtica.
- Freno a la fuerza bruta por origen (RF-02), con la limitación documentada allí.

### 9.2 Dónde se comprueba

Dos superficies, ninguna cubre a la otra:

| Superficie                      | Quién la protege                           |
| ------------------------------- | ------------------------------------------ |
| Navegaciones (`GET` de páginas) | `middleware.ts`, en el runtime Edge        |
| Server Actions (`POST`)         | `contenedorPrivado()` en `di/container.ts` |

El shell privado (`(privado)/layout.tsx`) vuelve a comprobar antes de renderizar. Es baratísimo y evita que un fallo de configuración del matcher del middleware exponga datos.

### 9.3 Acceso a datos

- **Un solo cliente de Supabase, con `service_role`, siempre en el servidor.** Omite RLS, y en un sistema monousuario eso no es un atajo: no hay filas de otro de las que aislarse.
- Lo que sustituye a RLS como barrera es que **la base está cerrada a los roles públicos** ([§6.5](#65-blindaje-de-acceso-a-la-base)): `anon` y `authenticated` no tienen ni un permiso, así que la API REST del proyecto no expone nada. **No se usa ni se configura clave anónima.**
- La clave `service_role` no puede llegar al navegador: el módulo que la lee lleva `import "server-only"` y el build falla si un componente de cliente lo importa.
- `SUPABASE_DB_URL` contiene la contraseña del usuario `postgres` (acceso total). La aplicación **nunca** la lee: solo las migraciones y los scripts de `scripts/`.
- Todo `input` validado con Zod antes de tocar el dominio.
- Endpoints de cron autenticados con `CRON_SECRET` en el encabezado `Authorization`.
- Auditoría de creación y modificación en todas las entidades de negocio ([§6.6](#66-triggers)).

### 9.4 Modelo de amenaza, dicho sin adornos

El token es **la única barrera** entre internet y todo el historial financiero: una sola, sin contraseña ni RLS por propietario detrás. Es la contrapartida honesta del sistema monousuario, y hay que tenerla presente al elegir el token y al decidir dónde se despliega ([ADR-15](#16-decisiones-técnicas-adr)).

De ahí se siguen tres consecuencias prácticas:

1. **La entropía del token es la seguridad del sistema.** Un token corto o con forma de contraseña común (`Admin123!` es exactamente el patrón que prueban primero los ataques por diccionario) reduce esa única barrera a casi nada. Conviene una cadena aleatoria larga.
2. **Conviene no publicar la URL.** No hay nada que descubrir en ella, pero sí una única puerta contra la que probar.
3. **Rotar es barato:** cambiar la variable de entorno cierra todas las sesiones y no toca la base.

Lo que sigue protegido pase lo que pase, incluso con el token comprometido: nada se puede hacer con la clave publicable de Supabase, los soportes solo se sirven por URL firmada de vida corta, y el catálogo del sistema no se puede corromper porque lo defiende un trigger.

---

## 10. Notificaciones y tareas programadas

### 10.1 Tareas (Vercel Cron)

| Tarea                 | Frecuencia       | Endpoint                            | Responsabilidad                                                                         |
| --------------------- | ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| Generar ocurrencias   | diaria 05:00 COT | `/api/cron/obligaciones`            | Materializar ocurrencias faltantes en el horizonte de 12 meses.                         |
| Actualizar vencidos   | diaria 05:10 COT | `/api/cron/estados`                 | Pasar a `vencido` movimientos y ocurrencias `pendiente` con vencimiento anterior a hoy. |
| Programar avisos      | diaria 05:20 COT | `/api/cron/notificaciones`          | Crear notificaciones según `dias_aviso`.                                                |
| Enviar notificaciones | cada hora        | `/api/cron/notificaciones?enviar=1` | Enviar pendientes, marcar enviadas, reintentar fallidas (máx. 3).                       |

Todas las tareas son **idempotentes**: ejecutarlas dos veces el mismo día no duplica ocurrencias ni correos (garantizado por los índices únicos de [§6.3](#63-esquema)).

> **Y conviene saber cómo se descubrió que esa frase era falsa.** `notificaciones_unicas_idx` nació parcial (`where ocurrencia_id is not null`). Un índice parcial no sirve para inferir un `on conflict (columnas)` a menos que la sentencia repita el predicado, y PostgREST —que traduce el `upsert` del adaptador— solo puede enviar la lista de columnas. Así que la tarea no era idempotente: **era imposible**. Respondía `42P10` y programaba cero avisos, con 121 ocurrencias en la base esperando. Lo tapaba una asimetría entre el doble y el esquema: el repositorio en memoria construye la clave con un centinela (`ocurrencia_id ?? "sin-ocurrencia"`), tratando los nulos como iguales, así que sus pruebas pasaban en verde describiendo una regla que la base no tenía. La undécima migración pone el índice como el doble ya lo suponía, y la prueba de esquema verifica **el `on conflict` real** y no la existencia del índice, porque el índice existía y aun así no servía.

**Los horarios de `vercel.json` van en UTC**, que es lo único que Vercel Cron entiende:
las 05:00 COT de la tabla son `0 10 * * *`. Escribirlos en hora local es el error que
hace que la tarea corra a mediodía y nadie lo note hasta que un aviso llega tarde.

Los tres endpoints comparten guardia (`src/app/api/cron/autorizacion.ts`): comparan el
digesto de `CRON_SECRET` en tiempo constante y **rechazan la petición si el secreto no
está configurado**, en lugar de quedar abiertos. Un cron que no corre se nota; uno que
cualquiera puede disparar, no.

### 10.2 Canales

- **Email (Resend)**: resumen de próximos vencimientos y aviso individual. Sin `RESEND_API_KEY` ni `EMAIL_REMITENTE` el canal queda desactivado y los avisos se quedan `programada` en lugar de marcarse `fallida` ([§15.1](#151-variables-de-entorno)).
- **In-app (RF-59)**: las filas con `canal = 'in_app'` se crean y se marcan enviadas sin proveedor, porque publicarlas es solo dejarlas legibles. **Ya existe quien las lea:** la campana de la barra superior —con el conteo de no leídos— y el historial de `/avisos`.

  Tres decisiones que conviene no deshacer sin leer el motivo:

  1. **La lectura no es un estado de envío.** Los cuatro valores de `estado` describen si el aviso salió; la lectura vive en `leida_en` ([§6.3](#63-esquema)). Marcar `cancelada` al leer —la alternativa sin migración— habría hecho un aviso leído indistinguible de uno que nunca se envió, y `cancelada` es justo el estado que la cola excluye.
  2. **La campana muestra el aviso desde que su instante se cumple**, no desde que la tarea horaria lo marca `enviada`. No hay proveedor al que esperar, y esperar a la tarea retrasaría el aviso hasta una hora: llegar tarde a quien debe reaccionar es el defecto que el canal existe para evitar. El predicado vive en `Notificacion.publicada()` y se repite —en el mismo orden— en el índice parcial de §6.3 y en el adaptador.
  3. **Las canceladas quedan fuera, y de ahí sale gratis una propiedad útil:** `cancelarDeOcurrencia` ya cancela los avisos de una ocurrencia al pagarla u omitirla, así que pagar la obligación limpia su aviso de la campana sin una línea de código dedicada.

  Leer **uno** pasa por la entidad (`MarcarAvisoLeido` carga, aplica la regla del canal y guarda); marcar **todos** es una operación de conjunto en el puerto, porque cargar N avisos para poner la misma marca es ceremonia sin invariante que proteger.

  La necesidad de fondo —ver qué vence y qué está vencido— la sigue resolviendo el panel de agenda de RF-58: la campana avisa, la agenda es donde se actúa, y por eso el panel enlaza a `/obligaciones`.

- **WhatsApp**: el puerto `NotificadorWhatsApp` existe y el caso de uso lo trata como canal opcional; **falta el adaptador**, así que esos avisos quedan programados sin enviarse en lugar de fallar. Decidir el proveedor es lo único pendiente ([§17](#17-supuestos-y-pendientes-por-definir)).

### 10.3 Plantillas de correo

Resumen semanal (lunes), aviso individual N días antes, y aviso de obligación vencida. Contenido: proyecto, concepto, valor estimado, fecha, enlace directo al registro de pago.

---

## 11. Reportes y exportación

- Los reportes se construyen sobre los mismos casos de uso de consulta del dashboard: una sola definición de cifras.
- Filtros comunes: proyecto, rango de fechas, tipo de movimiento, categoría, estado.
- **Excel:** una hoja de datos con encabezados y una hoja de resumen con totales; columnas de valor con formato de moneda —**la del reporte**, no un `$` fijo, que era lo que hacía la hoja de datos mientras la de resumen sí respetaba `reporte.moneda`—.
- **PDF:** encabezado con el título del reporte, los filtros aplicados y la fecha de generación; tabla paginada; totales al cierre. **Sin nombre de usuario:** no hay ninguno que poner ([ADR-14](#16-decisiones-técnicas-adr)).
- **Cada total del pie declara su tipo** (`dinero` o `numero`), igual que cada columna. Era `{ etiqueta, valor: string }` y los tres consumidores adivinaban el formato con reglas distintas: la previsualización aplicaba moneda por encima de 999 y el PDF a todo lo numérico, así que «Movimientos: 1.200» —un conteo de filas— se imprimía como `$ 1.200` y unos «Ingresos: 800» se quedaban sin símbolo. El tipo lo pone quien construye el reporte, que es el único que sabe si cuenta cosas o suma dinero.
- **En pantalla los totales van encima de la tabla**, como tarjetas de indicador: son la respuesta, y estaban al pie, detrás de cincuenta filas de previsualización.
- Generación en API Route (`/api/exportar/[formato]`, un solo handler para `xlsx` y `pdf`); nombre de archivo `{reporte}_{proyecto}_{yyyyMMdd}.{ext}`.
- **RF-103 va por su propia ruta**, `/api/exportar/datos`: exporta el volcado completo en JSON y no comparte ni filtros ni formato con los reportes.
- Límite de 10.000 filas por exportación; si se excede, se solicita refinar los filtros.

---

## 12. Requerimientos no funcionales

| ID     | Requerimiento                                                                                 | Verificación                                                                                                                                                                                                         |
| ------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | Diseño responsive en escritorio, tablet y móvil.                                              | Sin scroll horizontal a 375 px; tablas colapsan a tarjetas.                                                                                                                                                          |
| RNF-02 | Interfaz moderna e intuitiva, consistente con shadcn/ui.                                      | Un usuario nuevo registra un movimiento sin instrucciones.                                                                                                                                                           |
| RNF-03 | Modo claro y oscuro con preferencia persistida.                                               | Ambos temas legibles en todas las vistas y gráficas.                                                                                                                                                                 |
| RNF-04 | Accesibilidad: navegación por teclado, foco visible, contraste AA, etiquetas en formularios.  | Auditoría axe sin errores críticos.                                                                                                                                                                                  |
| RNF-05 | Rendimiento: LCP < 2,5 s y TTI < 3 s en 4G.                                                   | Lighthouse ≥ 90 en rendimiento.                                                                                                                                                                                      |
| RNF-06 | Listados de 5.000 movimientos con filtros en menos de 1 s.                                    | Paginación en servidor e índices de [§6.3](#63-esquema).                                                                                                                                                             |
| RNF-07 | Validación en cliente y servidor con esquema único.                                           | Deshabilitar JavaScript no permite datos inválidos.                                                                                                                                                                  |
| RNF-08 | Auditoría de creación y modificación de todos los registros.                                  | `registro_auditoria` con entidad, acción y diferencias. **Sin actor:** hay un solo operador, así que la pregunta que responde es «qué cambió y cuándo» ([§6.3](#63-esquema), [ADR-14](#16-decisiones-técnicas-adr)). |
| RNF-09 | Búsquedas rápidas y filtros avanzados combinables.                                            | Filtros persistidos en la URL (compartibles).                                                                                                                                                                        |
| RNF-10 | Escalabilidad: nuevos tipos de proyecto sin tocar la lógica existente.                        | Checklist de [§13](#13-extensibilidad-agregar-un-tipo-de-proyecto) sin migraciones.                                                                                                                                  |
| RNF-11 | La base no expone nada a los roles públicos de Supabase, ni hoy ni tras la próxima migración. | Pruebas de blindaje de [§8.8](#88-pruebas) y `npm run db:inspect`.                                                                                                                                                   |
| RNF-12 | Estados vacíos, de carga y de error en cada vista.                                            | Skeletons y mensajes con acción sugerida.                                                                                                                                                                            |
| RNF-13 | Idioma español (es-CO) en toda la interfaz, incluidos errores y exportaciones.                | Sin cadenas en inglés visibles.                                                                                                                                                                                      |
| RNF-14 | Cero errores de tipos y de lint en `main`.                                                    | CI bloqueante.                                                                                                                                                                                                       |
| RNF-15 | Respaldo diario de la base y recuperación puntual.                                            | Backups de Supabase habilitados.                                                                                                                                                                                     |

---

## 13. Extensibilidad: agregar un tipo de proyecto

Objetivo del RNF-10: incorporar Construcción de vivienda, Negocio, Inversión, Fondos, Acciones, Criptomonedas, Viajes o Proyectos empresariales **sin migraciones ni cambios en la lógica existente**.

Mecanismo: `tipos_proyecto.configuracion` (JSONB) declara los atributos propios y los indicadores visibles; `proyectos.atributos` (JSONB) guarda los valores; el formulario y el panel se generan a partir de esa configuración.

```json
{
  "atributos": [
    { "clave": "placa", "etiqueta": "Placa", "tipo": "text", "requerido": true },
    { "clave": "marca", "etiqueta": "Marca", "tipo": "text", "requerido": true },
    { "clave": "modelo", "etiqueta": "Modelo", "tipo": "number", "requerido": false },
    { "clave": "cilindraje", "etiqueta": "Cilindraje", "tipo": "number", "requerido": false }
  ],
  "indicadores": [
    "total_invertido",
    "total_egresos",
    "tco",
    "costo_mensual",
    "proximas_obligaciones"
  ],
  "categorias_sugeridas": [
    "compra",
    "matricula",
    "accesorios",
    "mantenimiento",
    "soat",
    "impuesto_vehicular"
  ],
  "genera_ingresos": false,
  "se_valoriza": true
}
```

**Checklist para un tipo nuevo:**

1. Insertar el registro en `tipos_proyecto` con su `configuracion` (semilla o pantalla de configuración).
2. Sembrar sus categorías en `categorias` con la naturaleza correcta.
3. Verificar que los indicadores declarados existan en el registro de indicadores del dominio: el catálogo `CATALOGO` de `panel-indicadores.tsx`. Una clave que no esté allí no rompe nada, simplemente no se dibuja, y ese silencio es peor que un error.
4. Escribir las etiquetas de los atributos **con tildes**: son texto de interfaz (RNF-13). Las `clave` sí van sin acentos ni espacios, porque son identificadores.
5. Sin cambios en esquema, casos de uso ni componentes: el formulario dinámico y el panel de indicadores lo resuelven.

Si un tipo requiere un cálculo genuinamente nuevo (por ejemplo TIR para fondos de inversión), se agrega un indicador al registro de dominio y se declara en la configuración: extensión, no modificación.

---

## 14. Alcance implementado

Las seis fases están cerradas: cada módulo existe con sus cuatro capas
([§7.1](#71-principios)), sus pruebas en verde y una pantalla que lo invoca. Queda como
registro del alcance acordado, no como plan por ejecutar; lo que sigue abierto está en
[§17](#17-supuestos-y-pendientes-por-definir).

| Fase | Alcance                                                                                                                                | Requerimientos                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 0    | Andamiaje Next.js, tooling, esquema y blindaje de la base, contenedor de dependencias, CI bloqueante y despliegue                      | RNF-14                                                                                 |
| 1    | Acceso por token, ajustes, proyectos con atributos dinámicos, catálogos, movimientos con filtros y resumen financiero por proyecto     | RF-01 a RF-04, RF-10 a RF-15, RF-18, RF-20 a RF-24, RF-26, RF-30 a RF-34, RF-101       |
| 2    | Soportes documentales con descarga firmada, obligaciones con recurrencia, ocurrencias materializadas y pago que crea el movimiento     | RF-25, RF-40 a RF-46, RF-50 a RF-58                                                    |
| 3    | Panel sobre las vistas de agregación, calendario financiero mensual, reportes filtrables con Excel y PDF, configuración de catálogos   | RF-28, RF-47, RF-60 a RF-64, RF-70, RF-71, RF-73 a RF-77, RF-79, RF-90 a RF-95, RF-100 |
| 4    | Pasivos y valoraciones, flujo proyectado a 12 meses, presupuestos con comparativo, patrimonio neto, avisos por correo y bandeja in-app | RF-16, RF-17, RF-29, RF-53, RF-59, RF-72, RF-78, RF-80 a RF-83, RF-102                 |
| 5    | Importación CSV con previsualización, exportación total en JSON y tipos de proyecto nuevos (construcción, inversiones, cripto, viajes) | RF-27, RF-103                                                                          |

**«Implementado» se mide por camino completo, no por módulo.** Un requerimiento no está
cerrado porque su dominio, su caso de uso y sus pruebas existan: lo está cuando una
pantalla lo invoca y el camino se recorre de punta a punta. Medirlo por módulo produjo una
deuda que sobrevivió dos revisiones con las pruebas en verde, y es la razón por la que
`npm run test:e2e` recorre los escenarios de [§3](#3-escenarios-de-referencia) contra la
base real ([§8.8](#88-pruebas)).

## 15. Entorno y configuración

### 15.1 Variables de entorno

```bash
# Acceso — el sistema es monousuario (ADR-14)
TOKEN_ACCESO=                     # abre la aplicación; ÚNICA barrera de acceso (§9.4)
SECRETO_SESION=                   # firma la cookie de sesión; mínimo 32 caracteres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # omite RLS; solo servidor, nunca en el cliente
SUPABASE_DB_URL=                  # contraseña de postgres; solo migraciones y scripts/

# Aplicación
NEXT_PUBLIC_APP_URL=              # base de los enlaces del correo (§10.3) y de los E2E
CRON_SECRET=                      # protege /api/cron/*; mínimo 16 caracteres

# Correo. Sin estas dos, el canal de correo queda desactivado y las
# notificaciones se quedan programadas en lugar de fallar (§10.2).
RESEND_API_KEY=
EMAIL_REMITENTE=
```

No hay `NEXT_PUBLIC_SUPABASE_ANON_KEY`: sin usuarios de Supabase Auth no hay sesión que representar, y los roles públicos quedaron sin permisos a propósito ([§6.5](#65-blindaje-de-acceso-a-la-base)).

`.env.example` versionado sin valores; `.env*` en `.gitignore`.

Ambas credenciales de acceso se validan al leerse: si falta `TOKEN_ACCESO` o `SECRETO_SESION` tiene menos de 32 caracteres, la aplicación falla con un mensaje explícito en lugar de quedarse con una puerta abierta.

### 15.2 Puesta en marcha local

```bash
npm install
cp .env.example .env                # completar token, secreto y credenciales
npm run db:seed                     # migraciones + datos semilla
npm run db:inspect                  # tablas, RLS, blindaje, semillas
npm run db:verify-types             # los tipos TS coinciden con el esquema real
npm run dev
```

Sin Docker: las migraciones se aplican contra el proyecto Supabase en la nube.

**La región va dentro de la cadena de conexión.** El host del pooler la incluye (`aws-0-ca-central-1.pooler.supabase.com`). Con la región equivocada el error es `tenant/user postgres.<ref> not found`, que parece un problema de credenciales y no lo es. Cópiala del panel, no de otro proyecto.

**Tres subcomandos de la CLI no funcionan sin Docker:** `supabase db dump`, `supabase db diff` y `supabase gen types --db-url`. Los scripts de `scripts/` cubren esas necesidades con `postgres.js`.

### 15.3 Scripts

| Script                     | Acción                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`                      | Servidor de desarrollo                                                                                                                      |
| `build` / `start`          | Compilación y ejecución de producción                                                                                                       |
| `lint` / `lint:fix`        | ESLint (incluye las reglas de frontera de [§7.1](#71-principios))                                                                           |
| `format` / `format:check`  | Prettier                                                                                                                                    |
| `typecheck`                | `tsc --noEmit`                                                                                                                              |
| `test` / `test:watch`      | Vitest: unitarias, casos de uso y esquema en PGlite                                                                                         |
| `test:e2e` / `test:e2e:ui` | Playwright: los escenarios de [§3](#3-escenarios-de-referencia)                                                                             |
| `verify`                   | typecheck + lint + pruebas (lo que debe pasar antes de subir)                                                                               |
| `db:push` / `db:seed`      | Migraciones y semillas                                                                                                                      |
| `db:reset`                 | Borra el esquema y lo reconstruye desde cero (se niega si hay datos)                                                                        |
| `db:demo`                  | Borra los datos propios y siembra los cinco proyectos de `demo.sql` ([§6.8](#68-migraciones)); se niega si ya hay datos, salvo `-- --force` |
| `db:inspect`               | Tablas, RLS, vistas, triggers, semillas y **blindaje de permisos**                                                                          |
| `db:verify-types`          | Contrasta `database.types.ts` con el esquema real; falla si difieren                                                                        |
| `db:smoke`                 | Prueba end-to-end contra la base remota; se niega a correr si hay datos                                                                     |

Los scripts de base leen `SUPABASE_DB_URL` con `node --env-file=.env`, así que la contraseña no aparece en `package.json` ni en el historial del shell.

**No hay script `db:types`.** Un `supabase gen types` sobreescribiría
`database.types.ts`, que se escribe a mano y se verifica con `db:verify-types`
([§6.8](#68-migraciones)); tenerlo a mano era una invitación a perder las
anotaciones del archivo de un tirón.

**Ganchos de git ([§8.9](#89-git)):** `pre-commit` corre `lint-staged` (Prettier +
ESLint sobre lo que se comitea) y `typecheck` sobre el proyecto entero, porque un
cambio de tipos rompe archivos que no están en el commit. `pre-push` corre `test`.
Los E2E no van en un gancho: necesitan navegador y base con datos, y su sitio es CI.

### 15.4 Entornos

| Entorno    | App              | Base de datos            |
| ---------- | ---------------- | ------------------------ |
| Local      | `localhost:3000` | Supabase (proyecto dev)  |
| Preview    | Vercel por PR    | Supabase (proyecto dev)  |
| Producción | Vercel `main`    | Supabase (proyecto prod) |

---

## 16. Decisiones técnicas (ADR)

| #   | Decisión                                                                 | Motivo                                                                                                                                                                                                        | Consecuencia                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Next.js 15 full-stack (App Router + Server Actions)                      | Un solo despliegue, menos superficie, Server Components para rendimiento                                                                                                                                      | La lógica de dominio debe aislarse deliberadamente del framework                                                                                                                                                                                                                                                      |
| 02  | Arquitectura hexagonal                                                   | Reemplazar Supabase, correo o exportadores sin tocar el dominio; casos de uso testeables                                                                                                                      | Más archivos y ceremonia inicial                                                                                                                                                                                                                                                                                      |
| 03  | Sin Prisma: `supabase-js` + SQL en migraciones                           | Restricción del proyecto; RLS y SQL explícito                                                                                                                                                                 | Sin ORM: mapeo manual en adaptadores, tipos generados desde la base                                                                                                                                                                                                                                                   |
| 04  | Sin Docker                                                               | Restricción del proyecto                                                                                                                                                                                      | Desarrollo local contra Supabase en la nube; se requiere proyecto dev separado                                                                                                                                                                                                                                        |
| 05  | ~~RLS como segunda barrera obligatoria~~ · **Superada por ADR-15**       | Tenía sentido con usuarios; sin ellos no hay a quién aislar                                                                                                                                                   | Ver ADR-15: el aislamiento se sustituye por cierre total a los roles públicos                                                                                                                                                                                                                                         |
| 06  | `naturaleza` (capex/opex/ingreso/financiación) en categoría y movimiento | Distinguir "invertido" de "gastado" es el corazón de los indicadores                                                                                                                                          | Al crear una categoría se debe declarar su naturaleza                                                                                                                                                                                                                                                                 |
| 07  | Atributos dinámicos por tipo en JSONB                                    | Cumple RNF-10 sin migraciones por cada tipo nuevo                                                                                                                                                             | La validación de esos atributos ocurre en aplicación, no en el esquema                                                                                                                                                                                                                                                |
| 08  | Ocurrencias materializadas de obligaciones                               | Calendario, notificaciones y proyección consultables y filtrables por SQL                                                                                                                                     | Requiere tarea diaria idempotente                                                                                                                                                                                                                                                                                     |
| 09  | Solo movimientos `pagado` en cifras de caja                              | Evita cifras infladas por compromisos no ejecutados                                                                                                                                                           | Se necesitan dos vistas: ejecutado y proyectado                                                                                                                                                                                                                                                                       |
| 10  | `numeric(18,2)` + value object `Dinero`                                  | Precisión exacta y aritmética segura                                                                                                                                                                          | Prohibido operar montos como `number` sueltos                                                                                                                                                                                                                                                                         |
| 11  | Vistas SQL para agregados                                                | Una sola definición de cada cifra, reutilizada por dashboard y reportes                                                                                                                                       | Cambiar una fórmula implica migración                                                                                                                                                                                                                                                                                 |
| 12  | Borrado lógico en movimientos y documentos                               | Trazabilidad y auditoría                                                                                                                                                                                      | Todas las consultas deben excluir `anulado`/`eliminado_en`                                                                                                                                                                                                                                                            |
| 13  | Nomenclatura de dominio en español                                       | El lenguaje del modelo coincide con el del usuario                                                                                                                                                            | Se mantiene consistencia en tablas, rutas y clases                                                                                                                                                                                                                                                                    |
| 14  | **Sistema monousuario con acceso por token**                             | Es una instalación personal de un solo dueño. Mantener cuentas, registro, recuperación de contraseña y `propietario_id` en catorce tablas era pagar la complejidad del multiusuario sin recibir nada a cambio | Desaparecen `auth.users`, `perfiles` y `propietario_id`; el proyecto pasa a ser la raíz del grafo. **No hay ruta de vuelta al multiusuario sin migración**: reintroducirlo exige añadir la columna a todas las tablas y volver a poblarla                                                                             |
| 15  | **Cierre total a los roles públicos en lugar de RLS por propietario**    | Sin usuarios, las políticas `propietario_id = auth.uid()` no pueden escribirse. La alternativa es más simple y más estricta: RLS activo sin políticas, y `anon` / `authenticated` sin ningún permiso          | La aplicación accede con `service_role`, que omite RLS. **La barrera real pasa a ser el token, no la base** ([§9.4](#94-modelo-de-amenaza-dicho-sin-adornos)). A cambio, la clave publicable de Supabase deja de servir para nada y `RF-34` gana una garantía más fuerte: un trigger que ni `postgres` puede saltarse |

---

## 17. Supuestos y pendientes por definir

### 17.1 Supuestos vigentes (se implementa así salvo indicación contraria)

- **Instalación de un solo dueño.** No hay cuentas, ni proyectos compartidos, ni roles. El esquema **no deja la puerta abierta** a la colaboración: volver al multiusuario exige una migración que reintroduzca `propietario_id` en todas las tablas ([ADR-14](#16-decisiones-técnicas-adr)). Es la contrapartida asumida de la simplificación.
- **Moneda única COP** por proyecto. El campo `moneda` existe para habilitar multimoneda después, sin conversión automática en v1.
- **Sin manejo fiscal explícito** (IVA, retenciones). El valor registrado es el total pagado; si se requiere desglose se agrega en `metadatos`.
- **Combustible y consumos opcionales** se registran como OPEX normales; no hay módulo de consumo por kilómetro.
- **Horizonte de proyección por defecto: 12 meses**, configurable en los ajustes entre 1 y 60 (RF-101).
- **Zona horaria por defecto: `America/Bogota`.** Todo cálculo de vencimientos la usa, también en la base ([§8.5](#85-fechas)).
- **Depreciación no automática:** el valor del vehículo baja registrando valoraciones manuales.

### 17.2 Decisiones de alcance pendientes

Ninguna bloquea lo implementado; cada una abre trabajo nuevo si se resuelve por la
afirmativa.

| #   | Decisión pendiente                                                                                        | Qué cuesta si se resuelve                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | ¿Se descarta de forma definitiva compartir proyectos con otra persona (pareja, socio)?                    | La vuelta al multiusuario cuesta una migración de las catorce tablas y repoblarlas, no un ajuste ([ADR-14](#16-decisiones-técnicas-adr)). Conviene cerrarla antes de que haya volumen de datos reales          |
| P-2 | ¿Se registra el detalle de la tabla de amortización del crédito hipotecario, o basta el saldo y la cuota? | Hoy `pasivos` guarda saldo y cuota. El detalle exige tabla nueva, pantalla de carga y decidir qué manda cuando el banco recalcula                                                                              |
| P-3 | ¿Qué proveedor de WhatsApp: Twilio, API oficial de Meta, o basta el correo en v1?                         | Solo falta el adaptador. El puerto `NotificadorWhatsApp` existe y el caso de uso trata el canal como opcional: sin adaptador, esas notificaciones quedan **programadas** y no fallidas ([§10.2](#102-canales)) |
| P-4 | ¿Se convierte el ≥ 90 % de cobertura de [§8.8](#88-pruebas) en umbral bloqueante de CI?                   | Instalar `@vitest/coverage-v8`, añadir el script y el umbral, y aceptar que un PR pueda fallar por cobertura. Hoy la cifra no se mide en cada corrida, así que la columna de cobertura es una intención        |

### 17.3 Verificaciones que no se pueden hacer desde el repositorio

Ninguna prueba del repositorio puede darlas por buenas, así que **ninguna está dada por
buena.** Son la única deuda técnica abierta.

| #   | Verificación                                                                                        | Cómo se cierra                                                                                              |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| V-1 | **RNF-15, backups diarios de Supabase** con retención de siete días y una restauración de prueba    | En el panel de Supabase, y anotando aquí la fecha de la restauración de prueba                              |
| V-2 | **RNF-04, auditoría de accesibilidad** con axe sobre las rutas privadas                             | Pasada de axe sobre la aplicación desplegada; los hallazgos entran como requerimientos, no como notas       |
| V-3 | **RNF-05, medición de Lighthouse** contra los objetivos de [§12](#12-requerimientos-no-funcionales) | Lighthouse sobre el despliegue de producción, no sobre `npm run dev`, que no representa el rendimiento real |
