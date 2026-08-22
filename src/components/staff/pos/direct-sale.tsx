"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  Printer,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { directSale } from "@/app/actions/pos";
import { Keyboard } from "@/components/staff/pos/keyboard";
import { ProductPicker } from "@/components/staff/pos/product-picker";
import { useTecladoPropio } from "@/components/staff/use-pointer";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { PosMenuCategory, PosMenuProduct } from "@/lib/pos";

/** Como se paga en el mostrador. El mismo orden en que ocurre. */
const METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
] as const;

/** "Cocina, barra y comprobante": como se lee una lista corta en voz alta. */
function listar(nombres: string[]) {
  if (nombres.length < 2) return nombres.join("");

  return `${nombres.slice(0, -1).join(", ").toLowerCase()} y ${nombres[nombres.length - 1]!.toLowerCase()}`;
}

type Line = PosMenuProduct & {
  quantity: number;
  /** La respuesta a lo que pregunta el producto: "Sprite", "Con gas". */
  variant: string | null;
  /** Producto y respuesta: dos sabores del mismo combo son dos lineas. */
  key: string;
};

/**
 * Cobro directo: lo que se pide y se paga en el mismo momento.
 *
 * Es la venta que no pasa por ninguna mesa —alguien se acerca a la barra,
 * pide una cerveza y la paga— y que antes no tenia donde anotarse: la plata
 * entraba y el consumo no quedaba registrado en ninguna parte. Por eso el
 * cierre de caja y el ranking de lo que mas se vende iban cortos todas las
 * noches, y por eso esta pantalla existe.
 *
 * Toda la venta se arma aca, en el navegador, y viaja entera en un solo envio
 * al momento de cobrar. No es una optimizacion: es que en el mostrador no hay
 * cuenta que quede abierta. Si el cliente se arrepiente a mitad de camino, no
 * queda nada que cerrar ni que anular, y si algo falla al cobrar no se cobro y
 * no nacio ninguna cuenta huerfana.
 *
 * Los precios que se muestran son los de la carta que trajo el servidor, pero
 * el que vale es el que el servidor vuelve a leer al cobrar: esta pantalla
 * puede llevar horas abierta en el mostrador.
 */
export function DirectSale({
  menu,
  frequent,
}: {
  menu: PosMenuCategory[];
  frequent: PosMenuProduct[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [verPedido, setVerPedido] = useState(false);

  /* Estable entre dibujados: la rejilla de la carta esta memorizada y una
     funcion nueva por cada toque la obligaria a rehacerse entera. */
  const pick = useCallback((product: PosMenuProduct, option?: string) => {
    const variant = option?.trim() || null;
    const key = `${product.id}|${variant ?? ""}`;

    setLines((current) => {
      const existente = current.find((line) => line.key === key);

      /*
       * El mismo producto tocado dos veces es una linea de dos, no dos lineas:
       * es como se lee un pedido de mostrador y como se cuenta. Salvo que las
       * respuestas difieran —una Fanta y una Sprite—, que son dos cosas
       * distintas de preparar.
       */
      if (existente) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(99, line.quantity + 1) }
            : line,
        );
      }

      return [...current, { ...product, quantity: 1, variant, key }];
    });
  }, []);

  const cambiarCantidad = (key: string, delta: number) => {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];

        const quantity = line.quantity + delta;
        // Bajar de uno es quitarlo: nadie quiere una linea de cero productos.
        return quantity < 1 ? [] : [{ ...line, quantity: Math.min(99, quantity) }];
      }),
    );
  };

  const quitar = (key: string) =>
    setLines((current) => current.filter((line) => line.key !== key));

  const totalCents = lines.reduce(
    (total, line) => total + (line.unitPriceCents - line.discountCents) * line.quantity,
    0,
  );

  const unidades = lines.reduce((total, line) => total + line.quantity, 0);

  /*
   * Los papeles que va a sacar la impresora, en el orden en que salen.
   *
   * Se calcula aca solo para avisarlo: quien cobra esta parado frente al
   * cliente y tiene que saber cuantos papeles esperar antes de soltar la caja.
   * Con una sola impresora salen de a uno, con unos segundos entre medio, y
   * cada uno va a un lado distinto —cocina, barra y la mano del cliente—.
   */
  const papeles = [
    ...(lines.some((line) => line.station === "COCINA") ? ["Cocina"] : []),
    ...(lines.some((line) => line.station === "BARRA") ? ["Barra"] : []),
    "Comprobante",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/*
        El pedido, siempre a la vista donde hay lugar.

        En la pantalla del mostrador vive fijo en su columna: el cliente esta
        del otro lado mirando lo que se le carga. En un telefono no cabe al
        lado de la carta, asi que se abre desde el pie —y el pie ya dice
        cuantos van y cuanto es, que es lo que se mira todo el tiempo—.
      */}
      <aside className="hidden min-h-0 w-80 shrink-0 flex-col border-r border-line bg-ink lg:flex">
        <Pedido
          lines={lines}
          onLess={(id) => cambiarCantidad(id, -1)}
          onMore={(id) => cambiarCantidad(id, 1)}
          onRemove={quitar}
        />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <ProductPicker
            menu={menu}
            frequent={frequent}
            dinerId={null}
            dinerLabel="Cobro directo"
            variant="panel"
            onClose={() => router.push("/staff/pos")}
            onPick={pick}
          />
        </div>

        <footer className="shrink-0 border-t border-line bg-ink-soft px-3 py-3 pb-safe">
          <div className="flex items-center gap-2">
            {/* En el telefono, la unica puerta al detalle de lo cargado. */}
            <button
              type="button"
              onClick={() => setVerPedido(true)}
              disabled={lines.length === 0}
              className="flex h-14 flex-1 flex-col justify-center border border-line px-3 text-left disabled:opacity-50 lg:pointer-events-none lg:border-transparent"
            >
              <span className="text-xs text-muted">
                {unidades === 0
                  ? "Sin nada cargado"
                  : `${unidades} ${unidades === 1 ? "producto" : "productos"}`}
                <span className="lg:hidden">{lines.length > 0 && " · ver pedido"}</span>
              </span>
              <span className="font-display text-xl text-bone">
                {formatPrice(totalCents)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCobrando(true)}
              disabled={lines.length === 0}
              className="flex h-14 flex-1 items-center justify-center gap-2 bg-crimson text-base font-medium text-bone disabled:opacity-50"
            >
              <Receipt className="size-5" aria-hidden />
              Cobrar
            </button>
          </div>
        </footer>
      </div>

      {verPedido && (
        <div className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm lg:hidden">
          <div className="flex max-h-[80dvh] w-full flex-col border-t border-line bg-ink-soft pb-safe">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="font-display text-lg text-bone">El pedido</h2>
              <button
                type="button"
                onClick={() => setVerPedido(false)}
                className="flex size-11 items-center justify-center border border-line text-bone"
                aria-label="Volver a la carta"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <Pedido
              lines={lines}
              onLess={(id) => cambiarCantidad(id, -1)}
              onMore={(id) => cambiarCantidad(id, 1)}
              onRemove={quitar}
            />
          </div>
        </div>
      )}

      {cobrando && (
        <CobroSheet
          lines={lines}
          totalCents={totalCents}
          papeles={papeles}
          onClose={() => setCobrando(false)}
          onDone={() => {
            setLines([]);
            setCobrando(false);
            setVerPedido(false);
          }}
        />
      )}
    </div>
  );
}

/** Lo cargado hasta ahora, con las manos para corregirlo. */
function Pedido({
  lines,
  onLess,
  onMore,
  onRemove,
}: {
  lines: Line[];
  onLess: (key: string) => void;
  onMore: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        Toca los productos de la carta. Se cobran todos juntos.
      </p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
      {lines.map((line) => (
        <li key={line.key} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-bone">
              {line.name}
              {/* Lo elegido va pegado al nombre: es parte de lo que hay que
                  servir, no una nota al pie. */}
              {line.variant && (
                <span className="text-gilt-soft"> · {line.variant}</span>
              )}
            </p>
            <p className="text-xs text-muted">
              {formatPrice(
                (line.unitPriceCents - line.discountCents) * line.quantity,
              )}
              {line.discountCents > 0 && (
                <span className="text-gilt-soft"> · {line.discountLabel}</span>
              )}
              {line.station === "COCINA" && (
                <span className="text-muted-dark"> · cocina</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onLess(line.key)}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
            aria-label={`Quitar uno de ${line.name}`}
          >
            <Minus className="size-4" aria-hidden />
          </button>

          <span
            className="w-6 shrink-0 text-center font-display text-lg text-bone"
            aria-live="polite"
          >
            {line.quantity}
          </span>

          <button
            type="button"
            onClick={() => onMore(line.key)}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
            aria-label={`Agregar uno de ${line.name}`}
          >
            <Plus className="size-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => onRemove(line.key)}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-muted"
            aria-label={`Sacar ${line.name} del pedido`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * El cobro: a nombre de quien y con que se paga.
 *
 * El nombre se pide siempre, y no por burocracia: lo que se acaba de vender
 * todavia no esta en la mano del cliente —un trago se prepara, la comida sale
 * de la cocina— y sin un nombre no hay forma de entregarlo ni de reclamarlo.
 * Va impreso en la comanda y en el comprobante. Igual se puede saltar de un
 * toque: con el local lleno hay ventas que se entregan antes de que alguien
 * alcance a escribir nada.
 */
function CobroSheet({
  lines,
  totalCents,
  papeles,
  onClose,
  onDone,
}: {
  lines: Line[];
  totalCents: number;
  /** Los papeles que va a sacar la impresora, en orden. */
  papeles: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState<string>("EFECTIVO");
  const [tecleando, setTecleando] = useState(false);

  /* En el mostrador no sube ningun teclado al enfocar un campo: ahi el nombre
     se escribe con el nuestro (ver `use-pointer`). */
  const tecladoPropio = useTecladoPropio();

  const cobrar = () => {
    const formData = new FormData();
    formData.set("method", method);
    formData.set("customer", customer.trim());
    formData.set(
      "lines",
      JSON.stringify(
        lines.map((line) => ({
          productId: line.id,
          quantity: line.quantity,
          ...(line.variant ? { variant: line.variant } : {}),
        })),
      ),
    );

    startTransition(async () => {
      setState(await directSale(IDLE, formData));
    });
  };

  const receipt =
    state.status === "success" ? String(state.data?.code ?? "") : null;

  /* Lo que dijo el servidor, que es lo unico que se puede leer en voz alta:
     esta pantalla mostraba precios que pudo haber cargado hace horas. */
  const chargedCents =
    state.status === "success"
      ? Number(state.data?.totalCents ?? totalCents)
      : totalCents;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cobro directo"
      className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm"
    >
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        {receipt ? (
          <div className="py-4 text-center">
            <p className="flex items-center justify-center gap-2 font-display text-2xl text-emerald-200">
              <Check className="size-6" aria-hidden />
              Cobrado
            </p>

            <p className="mt-3 font-display text-4xl text-bone">
              {formatPrice(chargedCents)}
            </p>

            <p className="mt-2 text-sm text-muted">N° de comprobante: {receipt}</p>

            {/* Lo que hay que ir a retirar. Salen de a uno por la misma
                ranura, con unos segundos entre medio: sin decirlo, el garzon
                se lleva el primero y deja los otros ahi. */}
            <p className="mt-3 text-sm text-muted">
              {papeles.length === 1
                ? "Sale el comprobante por la impresora."
                : `Salen ${papeles.length} papeles, uno tras otro: ${listar(papeles)}.`}
            </p>

            {/* Lo que sigue casi siempre es la venta del que viene atras. */}
            <button
              type="button"
              onClick={onDone}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 bg-crimson text-base font-medium text-bone"
            >
              <Plus className="size-5" aria-hidden />
              Otra venta
            </button>

            <button
              type="button"
              onClick={() => router.push("/staff/pos")}
              className="mt-3 flex h-14 w-full items-center justify-center gap-2 border border-bone/25 text-base text-bone"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Volver a la sala
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">
                  {lines.length} {lines.length === 1 ? "producto" : "productos"}
                </p>
                <h2 className="font-display text-xl text-bone">
                  Cobrar {formatPrice(totalCents)}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex size-11 items-center justify-center border border-line text-bone"
                aria-label="Volver al pedido"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {papeles.length > 1 && (
              <p className="mt-3 flex items-center gap-2 border border-gilt/40 px-3 py-2 text-sm text-gilt-soft">
                <Printer className="size-4 shrink-0" aria-hidden />
                Van a salir {papeles.length} papeles: {listar(papeles)}.
              </p>
            )}

            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-muted">
              ¿A nombre de quién?
            </p>

            {tecladoPropio ? (
              <button
                type="button"
                onClick={() => setTecleando(true)}
                className={[
                  "mt-2 flex h-14 w-full items-center border px-3 text-left text-base",
                  tecleando ? "border-crimson bg-ink" : "border-line bg-ink",
                ].join(" ")}
              >
                <span className={customer ? "text-bone" : "text-muted"}>
                  {customer || "Nombre del cliente"}
                </span>
              </button>
            ) : (
              <input
                type="text"
                value={customer}
                onChange={(event) => setCustomer(event.target.value.slice(0, 40))}
                placeholder="Nombre del cliente"
                aria-label="Nombre del cliente"
                autoComplete="off"
                enterKeyHint="done"
                className="mt-2 h-14 w-full border border-line bg-ink px-3 text-base text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
              />
            )}

            {tecladoPropio && tecleando && (
              <div className="mt-3">
                <Keyboard
                  onKey={(char) =>
                    setCustomer((current) => (current + char).slice(0, 40))
                  }
                  onBackspace={() => setCustomer((current) => current.slice(0, -1))}
                  onClear={() => setCustomer("")}
                  onDone={() => setTecleando(false)}
                  doneLabel="Listo"
                />
              </div>
            )}

            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-muted">
              ¿Con qué paga?
            </p>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {METHODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  className={[
                    "flex h-14 items-center justify-center border text-base",
                    method === option.value
                      ? "border-crimson bg-crimson/15 text-bone"
                      : "border-line text-bone-dim",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {state.status === "error" && (
              <p role="alert" className="mt-4 text-sm text-crimson-bright">
                {state.message}
              </p>
            )}

            <button
              type="button"
              onClick={cobrar}
              disabled={pending}
              className="mt-6 flex h-16 w-full items-center justify-center gap-2 bg-crimson text-lg font-medium text-bone disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Receipt className="size-5" aria-hidden />
              )}
              Cobrar {formatPrice(totalCents)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
