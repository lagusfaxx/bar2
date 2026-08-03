"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { addItem } from "@/app/actions/pos";
import { formatPrice } from "@/lib/format";
import { IDLE } from "@/lib/form-state";
import type { PosMenuCategory } from "@/lib/pos";

/**
 * Selector de productos.
 *
 * Se carga sobre la cuenta abierta, sin salir de la mesa: el garzon toca un
 * producto y ya queda cargado. Se mantiene abierto a proposito, porque los
 * pedidos vienen de a varios.
 */
export function ProductPicker({
  sessionId,
  dinerId,
  dinerLabel,
  menu,
  onClose,
}: {
  sessionId: string;
  dinerId: string | null;
  dinerLabel: string;
  menu: PosMenuCategory[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return menu;

    return menu
      .map((category) => ({
        ...category,
        products: category.products.filter((product) =>
          product.name.toLowerCase().includes(needle),
        ),
      }))
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
      // Contador efimero: confirma el toque sin tener que mirar la cuenta.
      setAdded((current) => ({
        ...current,
        [productId]: (current[productId] ?? 0) + 1,
      }));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-ink">
      <header className="shrink-0 border-b border-line px-4 py-3 pt-safe">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              Cargando a
            </p>
            <p className="truncate font-display text-lg text-bone">{dinerLabel}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center border border-line text-bone"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden />
          </button>
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
                {category.station === "BARRA" ? "· barra" : "· cocina"}
              </span>
            </h3>

            <ul className="flex flex-col gap-2">
              {category.products.map((product) => {
                const count = added[product.id] ?? 0;
                const final = product.unitPriceCents - product.discountCents;

                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => add(product.id, product.name)}
                      className="flex w-full items-center justify-between gap-3 border border-line bg-ink-soft px-4 py-3 text-left transition-colors hover:border-crimson disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-bone">
                          {product.name}
                        </span>

                        {product.discountCents > 0 && (
                          <span className="mt-0.5 block text-[0.65rem] uppercase tracking-[0.14em] text-gilt-soft">
                            {product.discountLabel} · antes{" "}
                            <s>{formatPrice(product.unitPriceCents)}</s>
                          </span>
                        )}
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-display text-bone">
                          {formatPrice(final)}
                        </span>

                        {count > 0 && (
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-[0.65rem] font-bold text-emerald-300">
                            {count}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <footer className="shrink-0 border-t border-line bg-ink-soft px-4 py-3 pb-safe">
        <button
          type="button"
          onClick={onClose}
          className="flex h-14 w-full items-center justify-center gap-2 bg-crimson font-medium uppercase tracking-[0.18em] text-bone"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          Listo
        </button>
      </footer>
    </div>
  );
}
