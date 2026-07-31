import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Documento } from "../domain/documento.entity";
import type {
  DocumentoListado,
  DocumentoRepository,
  FiltroDocumentos,
} from "../domain/documento.repository";

type Fila = Tablas<"documentos">;

const SELECT_LISTADO = `
  id, proyecto_id, movimiento_id, nombre_archivo, ruta_storage, tipo_documento,
  mime_type, tamano_bytes, cargado_en, eliminado_en,
  proyectos!inner ( nombre ),
  movimientos ( descripcion )
`;

function aDocumento(fila: Fila): Documento {
  return Documento.desdePersistencia({
    id: fila.id,
    proyectoId: fila.proyecto_id,
    movimientoId: fila.movimiento_id,
    nombreArchivo: fila.nombre_archivo,
    rutaStorage: fila.ruta_storage,
    tipoDocumento: fila.tipo_documento,
    mimeType: fila.mime_type,
    tamanoBytes: Number(fila.tamano_bytes),
    cargadoEn: fila.cargado_en,
    eliminadoEn: fila.eliminado_en,
  });
}

/** ADAPTADOR del puerto DocumentoRepository (Contexto.md §7.3). */
export class SupabaseDocumentoRepository implements DocumentoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string): Promise<Documento | null> {
    const { data, error } = await this.supabase
      .from("documentos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aDocumento(data) : null;
  }

  async listar(filtro: FiltroDocumentos = {}): Promise<DocumentoListado[]> {
    let consulta = this.supabase
      .from("documentos")
      .select(SELECT_LISTADO)
      // ADR-12: los eliminados no se muestran nunca.
      .is("eliminado_en", null)
      .order("cargado_en", { ascending: false });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.movimientoId) consulta = consulta.eq("movimiento_id", filtro.movimientoId);
    if (filtro.soloDeProyecto) consulta = consulta.is("movimiento_id", null);
    if (filtro.tipos?.length) consulta = consulta.in("tipo_documento", filtro.tipos);
    if (filtro.desde) consulta = consulta.gte("cargado_en", `${filtro.desde}T00:00:00Z`);
    if (filtro.hasta) consulta = consulta.lte("cargado_en", `${filtro.hasta}T23:59:59Z`);
    if (filtro.texto) consulta = consulta.ilike("nombre_archivo", `%${filtro.texto}%`);

    const { data, error } = await consulta;
    if (error) throw error;

    type FilaListado = Fila & {
      proyectos: { nombre: string } | null;
      movimientos: { descripcion: string } | null;
    };

    return ((data ?? []) as unknown as FilaListado[]).map((f) => {
      const documento = aDocumento(f);
      return {
        id: f.id,
        proyectoId: f.proyecto_id,
        proyectoNombre: f.proyectos?.nombre ?? "—",
        movimientoId: f.movimiento_id,
        movimientoDescripcion: f.movimientos?.descripcion ?? null,
        nombreArchivo: f.nombre_archivo,
        tipoDocumento: f.tipo_documento,
        mimeType: f.mime_type,
        tamanoBytes: Number(f.tamano_bytes),
        cargadoEn: f.cargado_en,
        esPrevisualizable: documento.esPrevisualizable,
        esImagen: documento.esImagen,
      };
    });
  }

  async guardar(documento: Documento): Promise<Documento> {
    const d = documento.aDatos();
    const { data, error } = await this.supabase
      .from("documentos")
      .insert({
        id: d.id,
        proyecto_id: d.proyectoId,
        movimiento_id: d.movimientoId,
        nombre_archivo: d.nombreArchivo,
        ruta_storage: d.rutaStorage,
        tipo_documento: d.tipoDocumento,
        mime_type: d.mimeType,
        tamano_bytes: d.tamanoBytes,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aDocumento(data);
  }

  async actualizar(documento: Documento): Promise<Documento> {
    const d = documento.aDatos();
    const { data, error } = await this.supabase
      .from("documentos")
      .update({ tipo_documento: d.tipoDocumento, eliminado_en: d.eliminadoEn })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aDocumento(data);
  }

  async contarPorProyecto(proyectoId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("proyecto_id", proyectoId)
      .is("eliminado_en", null);

    if (error) throw error;
    return count ?? 0;
  }

  async contarPorMovimiento(movimientoId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("movimiento_id", movimientoId)
      // Los eliminados liberan cupo: el tope es sobre lo que se ve (ADR-12).
      .is("eliminado_en", null);

    if (error) throw error;
    return count ?? 0;
  }
}
