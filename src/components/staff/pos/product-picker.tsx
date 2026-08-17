"use client";

import { Check, Loader2, MessageSquarePlus, Search, Send, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { addItem } from "@/app/actions/pos";
import { NoteSheet } from "@/components/staff/pos/note-sheet";
import { formatPrice } from "@/lib/format";
import { IDLE } from "@/lib/form-state";
import type { PosMenuCategory, PosMenuProduct } from "@/lib/pos";

/**
 * Selector de productos.
 *
 * Se carga sobre la cuenta abierta, sin salir de la mesa: el garzon toca un
 * producto y ya queda cargado. Se mantiene abierto a proposito, porque los
 * pedidos vienen de a varios.
 *
 * Tiene dos formas segun donde se use, y es la misma lista en las dos:
 *
 * - `ventana` es la del telefono: ocupa la pantalla completa, porque en 400
 *   puntos de ancho no cabe nada al lado.
 * - `panel` es la de la pantalla tactil del local: la carta vive fija en una
 *   columna a la derecha, siempre a la vista junto a la cuenta. En un POS de
 *   mostrador abrir y cerrar una ventana por cada producto es el gesto que mas
 *   se repite en toda la noche, y ahi sobra el espacio para evitarlo.
 */
export function ProductPicker({
  sessionId,
  dinerId,
  dinerLabel,
  menu,
  frequent,
  onClose,
  variant = "ventana",
  draftCount = 0,
  destino = "a la cocina",
  onSend,
  sending = false,
}: {
  sessionId: string;
  dinerId: string | null;
  dinerLabel: string;
  menu: PosMenuCategory[];
  frequent: PosMenuProduct[];
  onClose: () => void;
  variant?: "ventana" | "panel";
  /** Lo cargado que cocina y barra todavia no vieron, en toda la mesa. */
  draftCount?: number;
  /** Donde cae ese pedido: "a la cocina", "a la barra" o "a cocina y barra". */
  destino?: string;
  /** Manda el pedido y devuelve a la cuenta. Solo en el telefono. */
  onSend?: () => void;
  sending?: boolean;
}) {
  const enPanel = variant === "panel";
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  /** Ultima linea cargada, para poder ponerle una nota sin ir a buscarla. */
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);
  const [noting, setNoting] = useState(false);

  /** Cuantas lineas se cargaron desde que se abrio la lista. */
  const totalAdded = useMemo(
    () => Object.values(added).reduce((sum, count) => sum + count, 0),
    [added],
  );

  /*
   * Busca por producto y tambien por categoria.
   *
   * Antes solo miraba el nombre del producto, y en un bar eso deja fuera la
   * palabra que uno escribe primero: "cerveza" no encontraba nada, porque las
   * cervezas de la carta se llaman "Schop Kunstmann" o "Escudo". Lo mismo con
   * "trago", "vino" o "postre". Ahora, si lo escrito coincide con la
   * categoria, se muestra la categoria entera; si no, sus productos que
   * coincidan.
   */
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return menu;

    return menu
      .map((category) => {
        if (category.name.toLowerCase().includes(needle)) return category;

        return {
          ...category,
          products: category.products.filter((product) =>
            product.name.toLowerCase().includes(needle),
          ),
        };
      })
      .filter((category) => category.products.length > 0);
  }, [menu, query]);

  const add = (productId: string, name: string) => {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("productId", productId);
    formData.set("quantity", "1");
    if (dinerId) formData.set("dinerId", dinerId);

    startTransition(async () => {
      const result = await addItem(IDLE, formData);

      if (result.status === "error") {
        setError(result.message ?? `No se pudo cargar ${name}.`);
        return;
      }

      setError(null);
      setLast({ id: String(result.data?.itemId ?? ""), name });

      // Contador efimero: confirma el toque sin tener que mirar la cuenta.
      setAdded((current) => ({
        ...current,
        [productId]: (current[productId] ?? 0) + 1,
      }));
    });
  };

  return (
    <div
      className={
        enPanel
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-ink-soft"
          : "fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-ink"
      }
    >
      {/* La franja ciega ya la esquiva la cabecera de la cuenta: como panel,
          esta va debajo y no tiene que bajar de nuevo. A pantalla completa
          si, que ahi es lo primero que se ve. */}
      <header
        className={
          enPanel
            ? "shrink-0 border-b border-line px-4 py-3"
            : "shrink-0 border-b border-line px-4 py-3 pt-safe"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">Se agrega a la cuenta de</p>
            <p className="truncate font-display text-lg text-bone">{dinerLabel}</p>
          </div>

          {/* En panel no hay nada que cerrar: la carta es parte de la pantalla. */}
          {!enPanel && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
              aria-label="Volver a la cuenta sin enviar"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en la carta…"
            aria-label="Buscar producto"
            className="h-12 w-full border border-line bg-ink-soft pl-10 pr-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
          />
        </div>
      </header>

      {error && (
        <p role="alert" className="shrink-0 border-b border-crimson/40 bg-crimson/10 px-4 py-2 text-sm text-crimson-bright">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {/* Los frecuentes van primero: el grueso de los pedidos sale de aca
            sin buscar ni desplazarse. */}
        {!query.trim() && frequent.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-[0.6rem] uppercase tracking-[0.2em] text-gilt-soft">
              Los de siempre
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {frequent.map((product) => (
                <ProductButton
                  key={`frecuente-${product.id}`}
                  product={product}
                  count={added[product.id] ?? 0}
                  disabled={pending}
                  compact
                  onClick={() => add(product.id, product.name)}
                />
              ))}
            </div>
          </section>
        )}

        {results.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            Nada con ese nombre en la carta.
          </p>
        )}

        {results.map((category) => (
          <section key={category.id} className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              {category.name}
              <span className="text-bone-dim">
                {category.station === "BARRA" ? "\u00b7 barra" : "\u00b7 cocina"}
              </span>
            </h3>

            <ul className="flex flex-col gap-2">
              {category.products.map((product) => (
                <li key={product.id}>
                  <ProductButton
                    product={product}
                    count={added[product.id] ?? 0}
                    disabled={pending}
                    onClick={() => add(product.id, product.name)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="shrink-0 border-t border-line bg-ink-soft px-4 py-3 pb-safe">
        {/* Atajo a la nota de lo ultimo cargado: es cuando el garzon todavia
            tiene el "sin lechuga" fresco en la cabeza. */}
        {last?.id && (
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="mb-2 flex h-12 w-full items-center justify-center gap-2 border border-gilt/50 text-base text-gilt-soft"
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Agregar nota a {last.name}
          </button>
        )}

        {/*
          Tomar el pedido termina aca.

          Este boton mandaba a la cuenta y ahi habia que buscar otro para
          enviar: dos toques para una sola intencion —"ya esta, mandalo"— con
          una pantalla intermedia en el medio que no aporta nada, porque el
          garzon acaba de cargar los productos y los tiene frescos. Ahora envia
          y vuelve de una. Para salir sin mandar esta la X de la cabecera, que
          es el gesto de siempre para cerrar sin hacer nada.

          En panel no existe: la cuenta y su boton de enviar estan al lado.
        */}
        {enPanel ? (
          <p className="text-center text-sm text-muted">
            {totalAdded > 0
              ? `${totalAdded} ${totalAdded === 1 ? "producto agregado" : "productos agregados"} a la cuenta`
              : "Toca un producto para agregarlo a la cuenta"}
          </p>
        ) : draftCount > 0 && onSend ? (
          <button
            type="button"
            disabled={pending || sending}
            onClick={onSend}
            className="flex h-14 w-full items-center justify-center gap-2 bg-gilt text-base font-medium text-ink disabled:opacity-60"
          >
            {pending || sending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-5" aria-hidden />
            )}
            Enviar {draftCount} {destino}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center gap-2 border border-bone/25 text-base text-bone"
          >
            <Check className="size-4" aria-hidden />
            Volver a la cuenta
          </button>
        )}
      </footer>

      {noting && last?.id && (
        <NoteSheet
          itemId={last.id}
          itemName={last.name}
          current={null}
          onClose={() => setNoting(false)}
        />
      )}
    </div>
  );
}

/** Boton de un producto. `compact` es la version de rejilla, para frecuentes. */
function ProductButton({
  product,
  count,
  disabled,
  compact,
  onClick,
}: {
  product: PosMenuProduct;
  count: number;
  disabled: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const final = product.unitPriceCents - product.discountCents;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative w-full border border-line bg-ink-soft text-left transition-colors hover:border-crimson disabled:opacity-60",
        compact
          ? "flex min-h-20 flex-col justify-between p-3"
          : "flex items-center justify-between gap-3 px-4 py-3",
      ].join(" ")}
    >
      <span className={compact ? "block" : "min-w-0"}>
        <span
          className={
            compact
              ? "block text-sm leading-tight text-bone"
              : "block truncate text-bone"
          }
        >
          {product.name}
        </span>

        {product.discountCents > 0 && (
          <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.14em] text-gilt-soft">
            {product.discountLabel}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2 self-end">
        <span className="font-display text-bone">{formatPrice(final)}</span>

        {count > 0 && (
          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-[0.65rem] font-bold text-emerald-300">
            {count}
          </span>
        )}
      </span>
    </button>
  );
}
