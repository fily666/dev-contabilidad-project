/**
 * Tipos de la base de datos.
 *
 * Escrito a mano a partir de supabase/migrations, pero NO a ciegas: se verifica
 * columna por columna contra la base real con
 *
 *     npm run db:verify-types
 *
 * Ejecuta ese comando despues de cada migracion. Alternativamente, con el
 * proyecto enlazado, `npm run db:types` lo regenera desde Supabase.
 *
 * Esquema monousuario (ADR-14): no existe tabla de usuarios ni columna
 * propietario_id; `ajustes` es una fila unica con las preferencias.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EstadoProyecto = "activo" | "pausado" | "finalizado" | "archivado";
type TipoMovimiento = "ingreso" | "egreso";
type NaturalezaCategoria = "capex" | "opex" | "ingreso" | "financiacion";
type EstadoMovimiento = "pendiente" | "pagado" | "vencido" | "anulado";
type Frecuencia =
  | "unica"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual"
  | "personalizada";
type EstadoOcurrencia = "pendiente" | "pagada" | "vencida" | "omitida";
type TipoDocumento =
  | "factura"
  | "recibo"
  | "comprobante"
  | "contrato"
  | "escritura"
  | "fotografia"
  | "poliza"
  | "otro";
type TipoPasivo =
  | "credito_hipotecario"
  | "credito_vehiculo"
  | "credito_libre"
  | "tarjeta_credito"
  | "otro";
type CanalNotificacion = "email" | "whatsapp" | "in_app";
type EstadoNotificacion = "programada" | "enviada" | "fallida" | "cancelada";

export type Database = {
  public: {
    Tables: {
      ajustes: {
        Row: {
          id: boolean;
          moneda: string;
          zona_horaria: string;
          preferencias: Json;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: boolean;
          moneda?: string;
          zona_horaria?: string;
          preferencias?: Json;
        };
        Update: {
          moneda?: string;
          zona_horaria?: string;
          preferencias?: Json;
        };
        Relationships: [];
      };
      tipos_proyecto: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          icono: string | null;
          configuracion: Json;
          es_sistema: boolean;
          activo: boolean;
          creado_en: string;
        };
        // es_sistema queda fuera de Insert y Update a proposito: solo seed.sql
        // crea filas del sistema, y el trigger proteger_filas_de_sistema
        // impide modificarlas o promover una fila propia (§6.6).
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          icono?: string | null;
          configuracion?: Json;
          activo?: boolean;
        };
        Update: {
          codigo?: string;
          nombre?: string;
          icono?: string | null;
          configuracion?: Json;
          activo?: boolean;
        };
        Relationships: [];
      };
      proyectos: {
        Row: {
          id: string;
          tipo_proyecto_id: string;
          nombre: string;
          descripcion: string | null;
          fecha_inicio: string;
          fecha_fin: string | null;
          estado: EstadoProyecto;
          moneda: string;
          atributos: Json;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          tipo_proyecto_id: string;
          nombre: string;
          descripcion?: string | null;
          fecha_inicio: string;
          fecha_fin?: string | null;
          estado?: EstadoProyecto;
          moneda?: string;
          atributos?: Json;
        };
        Update: {
          tipo_proyecto_id?: string;
          nombre?: string;
          descripcion?: string | null;
          fecha_inicio?: string;
          fecha_fin?: string | null;
          estado?: EstadoProyecto;
          moneda?: string;
          atributos?: Json;
        };
        Relationships: [];
      };
      categorias: {
        Row: {
          id: string;
          tipo_proyecto_id: string | null;
          padre_id: string | null;
          nombre: string;
          naturaleza: NaturalezaCategoria;
          es_sistema: boolean;
          activa: boolean;
          orden: number;
          creado_en: string;
        };
        Insert: {
          id?: string;
          tipo_proyecto_id?: string | null;
          padre_id?: string | null;
          nombre: string;
          naturaleza: NaturalezaCategoria;
          activa?: boolean;
          orden?: number;
        };
        Update: {
          tipo_proyecto_id?: string | null;
          padre_id?: string | null;
          nombre?: string;
          naturaleza?: NaturalezaCategoria;
          activa?: boolean;
          orden?: number;
        };
        Relationships: [];
      };
      metodos_pago: {
        Row: {
          id: string;
          nombre: string;
          tipo: string;
          ultimos_digitos: string | null;
          activo: boolean;
          creado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          tipo?: string;
          ultimos_digitos?: string | null;
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          tipo?: string;
          ultimos_digitos?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      movimientos: {
        Row: {
          id: string;
          proyecto_id: string;
          categoria_id: string;
          metodo_pago_id: string | null;
          tipo: TipoMovimiento;
          naturaleza: NaturalezaCategoria;
          fecha: string;
          fecha_vencimiento: string | null;
          fecha_pago: string | null;
          valor: number;
          moneda: string;
          abono_capital: number | null;
          abono_interes: number | null;
          descripcion: string;
          observaciones: string | null;
          estado: EstadoMovimiento;
          motivo_anulacion: string | null;
          ocurrencia_id: string | null;
          metadatos: Json;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          proyecto_id: string;
          categoria_id: string;
          metodo_pago_id?: string | null;
          tipo: TipoMovimiento;
          naturaleza: NaturalezaCategoria;
          fecha: string;
          fecha_vencimiento?: string | null;
          fecha_pago?: string | null;
          valor: number;
          moneda?: string;
          abono_capital?: number | null;
          abono_interes?: number | null;
          descripcion: string;
          observaciones?: string | null;
          estado?: EstadoMovimiento;
          motivo_anulacion?: string | null;
          ocurrencia_id?: string | null;
          metadatos?: Json;
        };
        Update: {
          proyecto_id?: string;
          categoria_id?: string;
          metodo_pago_id?: string | null;
          tipo?: TipoMovimiento;
          naturaleza?: NaturalezaCategoria;
          fecha?: string;
          fecha_vencimiento?: string | null;
          fecha_pago?: string | null;
          valor?: number;
          moneda?: string;
          abono_capital?: number | null;
          abono_interes?: number | null;
          descripcion?: string;
          observaciones?: string | null;
          estado?: EstadoMovimiento;
          motivo_anulacion?: string | null;
          ocurrencia_id?: string | null;
          metadatos?: Json;
        };
        Relationships: [];
      };
      obligaciones: {
        Row: {
          id: string;
          proyecto_id: string;
          categoria_id: string;
          concepto: string;
          valor_estimado: number;
          fecha_vencimiento: string;
          frecuencia: Frecuencia;
          intervalo_meses: number | null;
          dias_aviso: number[];
          crear_movimiento_auto: boolean;
          activa: boolean;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          proyecto_id: string;
          categoria_id: string;
          concepto: string;
          valor_estimado: number;
          fecha_vencimiento: string;
          frecuencia: Frecuencia;
          intervalo_meses?: number | null;
          dias_aviso?: number[];
          crear_movimiento_auto?: boolean;
          activa?: boolean;
        };
        Update: {
          categoria_id?: string;
          concepto?: string;
          valor_estimado?: number;
          fecha_vencimiento?: string;
          frecuencia?: Frecuencia;
          intervalo_meses?: number | null;
          dias_aviso?: number[];
          crear_movimiento_auto?: boolean;
          activa?: boolean;
        };
        Relationships: [];
      };
      ocurrencias_obligacion: {
        Row: {
          id: string;
          obligacion_id: string;
          fecha_vencimiento: string;
          valor_estimado: number;
          estado: EstadoOcurrencia;
          movimiento_id: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          obligacion_id: string;
          fecha_vencimiento: string;
          valor_estimado: number;
          estado?: EstadoOcurrencia;
          movimiento_id?: string | null;
        };
        Update: {
          fecha_vencimiento?: string;
          valor_estimado?: number;
          estado?: EstadoOcurrencia;
          movimiento_id?: string | null;
        };
        Relationships: [];
      };
      documentos: {
        Row: {
          id: string;
          proyecto_id: string;
          movimiento_id: string | null;
          nombre_archivo: string;
          ruta_storage: string;
          tipo_documento: TipoDocumento;
          mime_type: string;
          tamano_bytes: number;
          cargado_en: string;
          eliminado_en: string | null;
        };
        Insert: {
          id?: string;
          proyecto_id: string;
          movimiento_id?: string | null;
          nombre_archivo: string;
          ruta_storage: string;
          tipo_documento?: TipoDocumento;
          mime_type: string;
          tamano_bytes: number;
        };
        Update: {
          nombre_archivo?: string;
          tipo_documento?: TipoDocumento;
          movimiento_id?: string | null;
          eliminado_en?: string | null;
        };
        Relationships: [];
      };
      pasivos: {
        Row: {
          id: string;
          proyecto_id: string;
          nombre: string;
          tipo: TipoPasivo;
          monto_original: number;
          saldo_actual: number;
          tasa_interes_ea: number | null;
          plazo_meses: number | null;
          valor_cuota: number | null;
          fecha_desembolso: string;
          activo: boolean;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: string;
          proyecto_id: string;
          nombre: string;
          tipo: TipoPasivo;
          monto_original: number;
          saldo_actual: number;
          tasa_interes_ea?: number | null;
          plazo_meses?: number | null;
          valor_cuota?: number | null;
          fecha_desembolso: string;
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          tipo?: TipoPasivo;
          monto_original?: number;
          saldo_actual?: number;
          tasa_interes_ea?: number | null;
          plazo_meses?: number | null;
          valor_cuota?: number | null;
          fecha_desembolso?: string;
          activo?: boolean;
        };
        Relationships: [];
      };
      valoraciones: {
        Row: {
          id: string;
          proyecto_id: string;
          fecha: string;
          valor: number;
          fuente: string | null;
          notas: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          proyecto_id: string;
          fecha: string;
          valor: number;
          fuente?: string | null;
          notas?: string | null;
        };
        Update: {
          fecha?: string;
          valor?: number;
          fuente?: string | null;
          notas?: string | null;
        };
        Relationships: [];
      };
      presupuestos: {
        Row: {
          id: string;
          proyecto_id: string | null;
          categoria_id: string;
          periodo_inicio: string;
          periodo_fin: string;
          valor_planeado: number;
          notas: string | null;
          creado_en: string;
        };
        Insert: {
          id?: string;
          proyecto_id?: string | null;
          categoria_id: string;
          periodo_inicio: string;
          periodo_fin: string;
          valor_planeado: number;
          notas?: string | null;
        };
        Update: {
          proyecto_id?: string | null;
          categoria_id?: string;
          periodo_inicio?: string;
          periodo_fin?: string;
          valor_planeado?: number;
          notas?: string | null;
        };
        Relationships: [];
      };
      notificaciones: {
        Row: {
          id: string;
          ocurrencia_id: string | null;
          canal: CanalNotificacion;
          asunto: string;
          cuerpo: string;
          programada_para: string;
          enviada_en: string | null;
          estado: EstadoNotificacion;
          error: string | null;
          intentos: number;
        };
        Insert: {
          id?: string;
          ocurrencia_id?: string | null;
          canal: CanalNotificacion;
          asunto: string;
          cuerpo: string;
          programada_para: string;
          estado?: EstadoNotificacion;
        };
        Update: {
          enviada_en?: string | null;
          estado?: EstadoNotificacion;
          error?: string | null;
          intentos?: number;
        };
        Relationships: [];
      };
      registro_auditoria: {
        Row: {
          id: number;
          entidad: string;
          entidad_id: string;
          accion: string;
          cambios: Json | null;
          ocurrido_en: string;
        };
        // Solo la escribe el trigger registrar_auditoria (§6.6).
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      v_resumen_proyecto: {
        Row: {
          proyecto_id: string;
          total_invertido: number;
          total_gastos_operativos: number;
          total_financiacion: number;
          total_egresos: number;
          total_ingresos: number;
          balance: number;
          abonos_a_capital: number;
          movimientos_pagados: number;
          ultimo_movimiento: string | null;
        };
        Relationships: [];
      };
      v_flujo_caja_mensual: {
        Row: {
          proyecto_id: string;
          mes: string;
          ingresos: number;
          egresos: number;
          flujo_neto: number;
        };
        Relationships: [];
      };
      v_metricas_12m: {
        Row: {
          proyecto_id: string;
          ingresos_12m: number;
          gastos_operativos_12m: number;
        };
        Relationships: [];
      };
      v_gastos_por_categoria: {
        Row: {
          proyecto_id: string;
          categoria_id: string;
          categoria_raiz: string;
          categoria: string;
          naturaleza: NaturalezaCategoria;
          total: number;
          cantidad: number;
        };
        Relationships: [];
      };
      v_agenda_obligaciones: {
        Row: {
          proyecto_id: string;
          proyecto: string;
          ocurrencia_id: string;
          obligacion_id: string;
          concepto: string;
          fecha_vencimiento: string;
          valor_estimado: number;
          estado: EstadoOcurrencia;
          movimiento_id: string | null;
          dias_restantes: number;
          categoria_id: string;
          moneda: string;
        };
        Relationships: [];
      };
      v_presupuesto_ejecucion: {
        Row: {
          presupuesto_id: string;
          proyecto_id: string | null;
          proyecto: string | null;
          categoria_id: string;
          categoria: string;
          naturaleza: NaturalezaCategoria;
          periodo_inicio: string;
          periodo_fin: string;
          valor_planeado: number;
          valor_real: number;
          desviacion: number;
          /** null cuando el planeado es cero: no hay porcentaje (guarda §5.3). */
          ejecucion: number | null;
          movimientos: number;
        };
        Relationships: [];
      };
      v_movimientos_mensual: {
        Row: {
          proyecto_id: string;
          mes: string;
          tipo: TipoMovimiento;
          naturaleza: NaturalezaCategoria;
          total: number;
          cantidad: number;
        };
        Relationships: [];
      };
      v_gastos_mensual_categoria: {
        Row: {
          proyecto_id: string;
          mes: string;
          categoria_id: string;
          categoria_raiz: string;
          naturaleza: NaturalezaCategoria;
          total: number;
          cantidad: number;
        };
        Relationships: [];
      };
      v_flujo_proyectado_mensual: {
        Row: {
          proyecto_id: string;
          mes: string;
          ingresos_esperados: number;
          egresos_estimados: number;
          flujo_proyectado: number;
        };
        Relationships: [];
      };
      v_patrimonio_proyecto: {
        Row: {
          proyecto_id: string;
          proyecto: string;
          valoracion_actual: number | null;
          valoracion_fecha: string | null;
          pasivo_total: number;
          patrimonio_neto: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      generar_ocurrencias: {
        Args: { p_horizonte_meses?: number };
        Returns: number;
      };
      marcar_vencidos: {
        Args: Record<string, never>;
        Returns: number;
      };
      meses_por_frecuencia: {
        Args: { p_frecuencia: Frecuencia; p_intervalo: number | null };
        Returns: number;
      };
      siguiente_vencimiento: {
        Args: { p_base: string; p_meses: number };
        Returns: string | null;
      };
    };
    Enums: {
      estado_proyecto: EstadoProyecto;
      tipo_movimiento: TipoMovimiento;
      naturaleza_categoria: NaturalezaCategoria;
      estado_movimiento: EstadoMovimiento;
      frecuencia: Frecuencia;
      estado_ocurrencia: EstadoOcurrencia;
      tipo_documento: TipoDocumento;
      tipo_pasivo: TipoPasivo;
      canal_notificacion: CanalNotificacion;
      estado_notificacion: EstadoNotificacion;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tablas<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Vistas<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
