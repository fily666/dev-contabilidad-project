"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import {
  DESCRIPCION_NATURALEZA,
  ETIQUETA_NATURALEZA,
  ETIQUETA_TIPO_MOVIMIENTO,
} from "@/shared/utils/etiquetas";
import {
  NATURALEZAS_POR_TIPO,
  type Naturaleza,
  type TipoMovimiento,
} from "@/shared/domain/enumeraciones";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import { categoriasDelTipo, sirveParaTipo } from "@/modules/categorias/domain/catalogo";
import { SelectorCategoria } from "@/modules/categorias/presentation/components/selector-categoria";
import { subirComprobanteAction } from "@/modules/documentos/presentation/actions";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { actualizarMovimientoAction, registrarMovimientoAction } from "../actions";
import { esquemaRegistrarMovimiento } from "../schemas";
import { AdjuntosMovimiento } from "./adjuntos-movimiento";

export type OpcionProyecto = {
  id: string;
  nombre: string;
  moneda: string;
  /** Acota el catalogo de categorias. Si falta, no se filtra: las pantallas de
   * un solo proyecto ya reciben las categorias de su tipo. */
  tipoProyectoId?: string;
};

/**
 * El formulario y la Server Action comparten el mismo esquema Zod (§8.7):
 * la entrada son las cadenas del formulario y la salida ya viene convertida
 * a numeros y nulos por el propio esquema.
 */
type ValoresFormulario = z.input<typeof esquemaRegistrarMovimiento>;
type SalidaFormulario = z.output<typeof esquemaRegistrarMovimiento>;

type Props = {
  proyectos: OpcionProyecto[];
  categorias: CategoriaConRuta[];
  metodosPago: MetodoPagoVista[];
  hoy: string;
  proyectoFijo?: string;
  movimiento?: {
    id: string;
    proyectoId: string;
    categoriaId: string;
    metodoPagoId: string | null;
    tipo: TipoMovimiento;
    naturaleza: Naturaleza;
    fecha: string;
    fechaVencimiento: string | null;
    valor: number;
    descripcion: string;
    observaciones: string | null;
  };
  alTerminar?: () => void;
};

/** RF-20, RF-21, RF-26, RF-29. */
export function FormularioMovimiento({
  proyectos,
  categorias,
  metodosPago,
  hoy,
  proyectoFijo,
  movimiento,
  alTerminar,
}: Props) {
  const router = useRouter();
  const editando = !!movimiento;

  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? "egreso");
  const [categoriaId, setCategoriaId] = useState(movimiento?.categoriaId ?? "");
  const [proyectoId, setProyectoId] = useState(
    movimiento?.proyectoId ?? proyectoFijo ?? proyectos[0]?.id ?? "",
  );
  const [naturalezaManual, setNaturalezaManual] = useState<Naturaleza | undefined>(
    movimiento?.naturaleza,
  );
  /** RF-40: soportes elegidos; se suben cuando el movimiento ya tiene id. */
  const [soportes, setSoportes] = useState<File[]>([]);
  const [subiendoSoportes, setSubiendoSoportes] = useState(false);

  const formulario = useForm<ValoresFormulario, unknown, SalidaFormulario>({
    resolver: zodResolver(esquemaRegistrarMovimiento),
    defaultValues: {
      proyectoId: movimiento?.proyectoId ?? proyectoFijo ?? proyectos[0]?.id ?? "",
      categoriaId: movimiento?.categoriaId ?? "",
      metodoPagoId: movimiento?.metodoPagoId ?? "",
      tipo: movimiento?.tipo ?? "egreso",
      naturaleza: movimiento?.naturaleza,
      fecha: movimiento?.fecha ?? hoy,
      fechaVencimiento: movimiento?.fechaVencimiento ?? "",
      valor: movimiento ? String(movimiento.valor) : "",
      descripcion: movimiento?.descripcion ?? "",
      observaciones: movimiento?.observaciones ?? "",
      estado: editando ? "pendiente" : "pagado",
      abonoCapital: "",
      abonoInteres: "",
    },
  });

  /**
   * Las compatibles con el tipo elegido (invariante §5.7.3) y con el tipo del
   * proyecto. Sin lo segundo, la pantalla global ofrecia el catalogo entero y
   * las raices se repetian: «Adquisición» existe en inmueble y en vehiculo.
   * Las transversales (`tipoProyectoId` nulo) sirven para cualquier proyecto.
   */
  const categoriasDisponibles = useMemo(() => {
    const permitidas = NATURALEZAS_POR_TIPO[tipo];
    const tipoDelProyecto = proyectos.find((p) => p.id === proyectoId)?.tipoProyectoId;
    return categoriasDelTipo(categorias, tipoDelProyecto).filter((c) =>
      permitidas.includes(c.naturaleza),
    );
  }, [categorias, tipo, proyectos, proyectoId]);

  const categoriaElegida = categoriasDisponibles.find((c) => c.id === categoriaId);
  const naturalezaEfectiva = naturalezaManual ?? categoriaElegida?.naturaleza;
  const esFinanciacion = naturalezaEfectiva === "financiacion";
  const naturalezasPermitidas = NATURALEZAS_POR_TIPO[tipo];

  /**
   * `estado` se lee del formulario y no de un `useState` aparte. Cuando vivia
   * fuera, el resolver de Zod validaba el valor por omision («pagado») aunque el
   * interruptor estuviera apagado, y era imposible registrar un movimiento
   * pendiente: exigia metodo de pago para algo que aun no se ha pagado.
   */
  const estado = formulario.watch("estado") ?? "pagado";

  /** Cambiar de proyecto puede dejar la categoria fuera del catalogo del tipo. */
  function elegirProyecto(nuevo: string) {
    setProyectoId(nuevo);
    formulario.setValue("proyectoId", nuevo, { shouldValidate: true });

    const tipoDelProyecto = proyectos.find((p) => p.id === nuevo)?.tipoProyectoId;
    if (sirveParaTipo(categorias, categoriaId, tipoDelProyecto)) return;

    setCategoriaId("");
    setNaturalezaManual(undefined);
    formulario.setValue("categoriaId", "");
  }

  /**
   * RF-40. De uno en uno y en serie, no en paralelo: el tope de siete se
   * comprueba en el servidor contando los soportes ya guardados, y siete
   * llamadas simultaneas leerian todas cero. Devuelve los que no entraron.
   */
  async function adjuntarSoportes(movimientoId: string, proyecto: string): Promise<string[]> {
    const fallidos: string[] = [];

    for (const archivo of soportes) {
      const datos = new FormData();
      datos.set("proyectoId", proyecto);
      datos.set("movimientoId", movimientoId);
      datos.set("tipoDocumento", "comprobante");
      datos.set("archivo", archivo);

      const resultado = await subirComprobanteAction(datos);
      if (!resultado.ok) fallidos.push(archivo.name);
    }

    return fallidos;
  }

  async function enviar(datos: SalidaFormulario) {
    const carga = {
      ...datos,
      naturaleza: naturalezaManual,
      abonoCapital: esFinanciacion ? datos.abonoCapital : null,
      abonoInteres: esFinanciacion ? datos.abonoInteres : null,
      ...(editando ? { id: movimiento.id } : {}),
    };

    const resultado = editando
      ? await actualizarMovimientoAction(carga)
      : await registrarMovimientoAction(carga);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        formulario.setError(campo as keyof ValoresFormulario, { message: mensajes[0] });
      }
      return;
    }

    toast.success(editando ? "Movimiento actualizado." : "Movimiento registrado.");

    // El movimiento ya esta guardado: si un soporte falla se avisa cual, pero no
    // se deshace nada. Perder el registro por un adjunto seria peor negocio.
    if (!editando && soportes.length > 0) {
      setSubiendoSoportes(true);
      const fallidos = await adjuntarSoportes(resultado.data.id, datos.proyectoId);
      setSubiendoSoportes(false);

      if (fallidos.length > 0) {
        toast.error(`No se pudieron subir estos soportes: ${fallidos.join(", ")}.`);
      } else {
        toast.success(soportes.length === 1 ? "Soporte adjuntado." : "Soportes adjuntados.");
      }
    }

    if (!editando) {
      setSoportes([]);
      formulario.reset({
        ...formulario.getValues(),
        valor: "",
        descripcion: "",
        observaciones: "",
        abonoCapital: "",
        abonoInteres: "",
      });
    }
    router.refresh();
    alTerminar?.();
  }

  const errores = formulario.formState.errors;
  const enviando = formulario.formState.isSubmitting;

  return (
    <form onSubmit={formulario.handleSubmit(enviar)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {!proyectoFijo ? (
          <div className="space-y-2">
            <Label htmlFor="proyectoId">
              Proyecto <span className="text-destructive">*</span>
            </Label>
            <Select value={proyectoId} onValueChange={(v) => elegirProyecto(v ?? "")}>
              <SelectTrigger id="proyectoId" className="w-full">
                <SelectValue placeholder="Selecciona un proyecto" />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errores.proyectoId ? (
              <p className="text-sm text-destructive">{errores.proyectoId.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="tipo">
            Tipo <span className="text-destructive">*</span>
          </Label>
          <Select
            value={tipo}
            onValueChange={(v) => {
              const nuevo = v as TipoMovimiento;
              setTipo(nuevo);
              formulario.setValue("tipo", nuevo, { shouldValidate: true });
              setCategoriaId("");
              setNaturalezaManual(undefined);
              formulario.setValue("categoriaId", "");
            }}
          >
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="egreso">{ETIQUETA_TIPO_MOVIMIENTO.egreso}</SelectItem>
              <SelectItem value="ingreso">{ETIQUETA_TIPO_MOVIMIENTO.ingreso}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SelectorCategoria
          categorias={categoriasDisponibles}
          valor={categoriaId}
          alCambiar={(id) => {
            setCategoriaId(id);
            setNaturalezaManual(undefined);
            formulario.setValue("categoriaId", id, { shouldValidate: true });
          }}
          requerido
          error={errores.categoriaId?.message}
        />

        <div className="space-y-2">
          <Label htmlFor="naturaleza">Naturaleza</Label>
          <Select
            value={naturalezaEfectiva ?? ""}
            onValueChange={(v) => setNaturalezaManual(v as Naturaleza)}
            disabled={!categoriaElegida}
          >
            <SelectTrigger id="naturaleza" className="w-full">
              <SelectValue placeholder="Se hereda de la categoría" />
            </SelectTrigger>
            <SelectContent>
              {naturalezasPermitidas.map((n) => (
                <SelectItem key={n} value={n}>
                  {ETIQUETA_NATURALEZA[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {naturalezaEfectiva
              ? DESCRIPCION_NATURALEZA[naturalezaEfectiva]
              : "Se propone según la categoría; puedes cambiarla."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="valor">
            Valor <span className="text-destructive">*</span>
          </Label>
          <Input
            id="valor"
            inputMode="decimal"
            placeholder="0"
            aria-invalid={!!errores.valor}
            {...formulario.register("valor")}
          />
          {errores.valor ? (
            <p className="text-sm text-destructive">{errores.valor.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fecha">
            Fecha <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fecha"
            type="date"
            aria-invalid={!!errores.fecha}
            {...formulario.register("fecha")}
          />
          {errores.fecha ? (
            <p className="text-sm text-destructive">{errores.fecha.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="metodoPagoId">Método de pago</Label>
          <Select
            defaultValue={movimiento?.metodoPagoId ?? ""}
            onValueChange={(v) => formulario.setValue("metodoPagoId", v ?? "")}
          >
            <SelectTrigger id="metodoPagoId" className="w-full">
              <SelectValue placeholder="Selecciona un método" />
            </SelectTrigger>
            <SelectContent>
              {metodosPago.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errores.metodoPagoId ? (
            <p className="text-sm text-destructive">{errores.metodoPagoId.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
          <Input id="fechaVencimiento" type="date" {...formulario.register("fechaVencimiento")} />
          <p className="text-xs text-muted-foreground">
            Opcional. Si pasa la fecha sin pagar, el movimiento aparece como vencido.
          </p>
        </div>
      </div>

      {esFinanciacion ? (
        <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Cuota de crédito: desglosa capital e intereses. La suma debe igualar el valor.
          </p>
          <div className="space-y-2">
            <Label htmlFor="abonoCapital">Abono a capital</Label>
            <Input id="abonoCapital" inputMode="decimal" {...formulario.register("abonoCapital")} />
            {errores.abonoCapital ? (
              <p className="text-sm text-destructive">{errores.abonoCapital.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="abonoInteres">Intereses</Label>
            <Input id="abonoInteres" inputMode="decimal" {...formulario.register("abonoInteres")} />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="descripcion">
          Descripción <span className="text-destructive">*</span>
        </Label>
        <Input
          id="descripcion"
          placeholder="Administración febrero, cambio de aceite…"
          aria-invalid={!!errores.descripcion}
          {...formulario.register("descripcion")}
        />
        {errores.descripcion ? (
          <p className="text-sm text-destructive">{errores.descripcion.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="observaciones">Observaciones</Label>
        <Textarea id="observaciones" rows={2} {...formulario.register("observaciones")} />
      </div>

      {/* Solo al crear: al editar, los soportes ya cargados se gestionan desde
          la pantalla de documentos del proyecto (RF-47). */}
      {!editando ? (
        <AdjuntosMovimiento archivos={soportes} alCambiar={setSoportes} deshabilitado={enviando} />
      ) : null}

      {!editando ? (
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <Label htmlFor="estado" className="cursor-pointer">
              Ya está pagado
            </Label>
            <p className="text-xs text-muted-foreground">
              Solo los movimientos pagados afectan el flujo de caja.
            </p>
          </div>
          <Switch
            id="estado"
            checked={estado === "pagado"}
            onCheckedChange={(marcado) =>
              formulario.setValue("estado", marcado ? "pagado" : "pendiente", {
                // Revalidar al cambiar: apagar el interruptor debe retirar en el
                // acto el error de «falta el método de pago», no dejarlo puesto.
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {alTerminar ? (
          <Button type="button" variant="ghost" onClick={alTerminar}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {subiendoSoportes
            ? "Subiendo soportes…"
            : editando
              ? "Guardar cambios"
              : "Registrar movimiento"}
        </Button>
      </div>
    </form>
  );
}
