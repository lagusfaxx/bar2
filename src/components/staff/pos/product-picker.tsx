"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
  Star,
  X,
} from "lucide-react";
import { memo, useCallback, useMemo, useState, useTransition } from "react";

import { addItem } from "@/app/actions/pos";
import { Keyboard } from "@/components/staff/pos/keyboard";
import { NoteSheet } from "@/components/staff/pos/note-sheet";
import { OptionSheet } from "@/components/staff/pos/option-sheet";
import { useTecladoPropio } from "@/components/staff/use-pointer";
import { formatPrice } from "@/lib/format";
import { IDLE } from "@/lib/form-state";
import type { PosMenuCategory, PosMenuProduct } from "@/lib/pos";
import { rankBySearch } from "@/lib/search";

/**
 * Selector de productos.
 *
 * Se carga sobre la cuenta abierta, sin salir de la mesa: el garzon toca un
 * producto y ya queda cargado. Se mantiene abierto a proposito, porque los
 * pedidos vienen de a varios.
 *
 * La pantalla trabaja en tres estados y nunca mas de uno a la vez, que es como
 * funciona cualquier POS de mostrador (Toast, Square, Lightspeed) y como
 * conviene que funcione el nuestro:
 *
 * 1. **Portada**: los de siempre, y despues las categorias. Nada mas.
 * 2. **Una categoria**: sus productos, en rejilla, con la vuelta arriba.
 * 3. **Buscando**: una sola lista ordenada por lo que mejor pega.
 *
 * Antes eran las tres cosas juntas, una debajo de la otra: la carta entera
 * apilada en una columna. Con doscientos productos eso es medio minuto de
 * deslizar con el cliente esperando, y el garzon terminaba usando siempre los
 * frecuentes porque el resto no valia la pena buscarlo. Dos toques a una
 * categoria de doce productos siempre le ganan a un deslizamiento largo: cada
 * pantalla ofrece pocas opciones, y por eso se elige rapido.
 *
 * Tiene dos formas segun donde se use, y es la misma lista en las dos:
 *
 * - `ventana` es la del telefono: ocupa la pantalla completa, porque en 400
 *   puntos de ancho no cabe nada al lado.
 * - `panel` es la de la pantalla tactil del local: la carta vive fija en una
 *   columna a la derecha, siempre a la vista junto a la cuenta. En un POS de
 *   mostrador abrir y cerrar una ventana por cada producto es el gesto que mas
 *   se repite en toda la noche, y ahi sobra el espacio para evitarlo.
 *
 * Tambien sirve para el cobro directo, donde todavia no hay cuenta donde
 * guardar nada: con `onPick` cada toque se lo queda quien la usa (ver
 * `direct-sale.tsx`) en vez de viajar al servidor. Es la misma carta, la misma
 * busqueda y los mismos frecuentes, sin una segunda lista que mantener.
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
  onPick,
}: {
  /** La cuenta donde cae lo tocado. Vacia en el cobro directo (ver `onPick`). */
  sessionId?: string;
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
  /**
   * Se queda con lo tocado en vez de cargarlo a una cuenta.
   * Es lo que usa el cobro directo, donde no hay cuenta abierta todavia: quien
   * la usa arma el pedido y lo cobra entero de una sola vez. Con esto puesto,
   * el pie de la carta queda para el que la muestra.
   */
  onPick?: (product: PosMenuProduct, option?: string) => void;
}) {
  const enPanel = variant === "panel";
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [tecleando, setTecleando] = useState(false);

  /* Solo el mostrador necesita que la app le ponga el teclado. En un telefono
     el del sistema es mejor y ya aparece solo (ver `use-pointer`). */
  const tecladoPropio = useTecladoPropio();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  /** Ultima linea cargada, para poder ponerle una nota sin ir a buscarla. */
  const [last, setLast] = useState<{ id: string; name: string } | null>(null);
  const [noting, setNoting] = useState(false);

  /** El producto que pregunta algo antes de cargarse. Ver `OptionSheet`. */
  const [preguntando, setPreguntando] = useState<PosMenuProduct | null>(null);

  /** Cuantas lineas se cargaron desde que se abrio la lista. */
  const totalAdded = useMemo(
    () => Object.values(added).reduce((sum, count) => sum + count, 0),
    [added],
  );

  /**
   * La carta aplanada, con la categoria pegada a cada producto.
   *
   * Es lo que se busca: en la busqueda no hay secciones, hay una sola lista
   * ordenada por que tan bien pega cada cosa. Que un producto diga a que
   * categoria pertenece es lo unico que se necesita de ellas ahi.
   */
  const indice = useMemo(
    () =>
      menu.flatMap((categoria) =>
        categoria.products.map((product) => ({
          ...product,
          category: categoria.name,
          categoriaId: categoria.id,
        })),
      ),
    [menu],
  );

  /**
   * Lo que mas se vende, para desempatar.
   *
   * Con "schop" en la mano hay cinco productos que pegan igual de bien. El que
   * salio doscientas veces en la quincena va primero: es, casi siempre, el que
   * se esta pidiendo.
   */
  const ranking = useMemo(
    () => new Map(frequent.map((product, indice) => [product.id, frequent.length - indice])),
    [frequent],
  );

  const buscando = query.trim().length > 0;

  /**
   * Resultados de la busqueda.
   *
   * El orden y el filtro viven en `lib/search`: tolera tildes, mayusculas,
   * palabras al reves y una letra mal escrita. Antes esto era un `includes()`
   * sobre el nombre, y en un tactil sin teclado eso significaba que un dedo
   * torpe no encontraba nada y volvia a deslizar la carta entera.
   *
   * Se corta en cuarenta: si lo escrito devuelve mas que eso, el problema es
   * que falta escribir, no que falte lista.
   */
  const resultados = useMemo(() => {
    if (!buscando) return [];

    return rankBySearch(indice, query, (product) => (ranking.get(product.id) ?? 0) * 50).slice(
      0,
      40,
    );
  }, [buscando, indice, query, ranking]);

  const categoria = useMemo(
    () => menu.find((candidate) => candidate.id === categoriaId) ?? null,
    [menu, categoriaId],
  );

  /*
   * Estable entre dibujados, para que los productos no se rehagan todos.
   *
   * Las fichas de la carta estan memorizadas (ver `ProductTile`), y una
   * memorizacion no sirve de nada si en cada tecla se les entrega una funcion
   * nueva: con doscientos productos, esa sola diferencia obliga a rehacer la
   * rejilla entera por cada letra escrita.
   */
  const cargar = useCallback(
    (product: PosMenuProduct, option?: string) => {
      /* Sin cuenta donde guardarlo: se lo lleva quien la muestra y el toque no
         cuesta ningun viaje al servidor. La pregunta del producto ya se
         respondio arriba, asi que la respuesta viaja igual que a una cuenta. */
      if (onPick) {
        onPick(product, option);
        setPreguntando(null);
        setAdded((current) => ({
          ...current,
          [product.id]: (current[product.id] ?? 0) + 1,
        }));
        return;
      }

      const formData = new FormData();
      formData.set("sessionId", sessionId ?? "");
      formData.set("productId", product.id);
      formData.set("quantity", "1");
      if (dinerId) formData.set("dinerId", dinerId);
      if (option) formData.set("variant", option);

      startTransition(async () => {
        const result = await addItem(IDLE, formData);

        if (result.status === "error") {
          setError(result.message ?? `No se pudo cargar ${product.name}.`);
          return;
        }

        setError(null);
        setLast({ id: String(result.data?.itemId ?? ""), name: product.name });
        setPreguntando(null);

        // Contador efimero: confirma el toque sin tener que mirar la cuenta.
        setAdded((current) => ({
          ...current,
          [product.id]: (current[product.id] ?? 0) + 1,
        }));
      });
    },
    [sessionId, dinerId, onPick, startTransition],
  );

  /**
   * Un toque en un producto.
   *
   * El camino corto es el de siempre y sigue siendo un solo toque. Solo cuando
   * el producto trae algo que preguntar —el sabor de la bebida, si el agua es
   * con gas— se abre la hoja, y ahi la respuesta es el segundo toque.
   *
   * Que la pregunta la traiga el producto y no una pantalla aparte es lo que
   * deja el resto de la carta intacto: el 95% de la noche esto no aparece.
   */
  const add = useCallback(
    (product: PosMenuProduct) => {
      if (product.options.length > 0) {
        setPreguntando(product);
        return;
      }

      cargar(product);
    },
    [cargar],
  );

  /** Abre una categoria. Estable, por lo mismo que `add`. */
  const abrirCategoria = useCallback((id: string) => setCategoriaId(id), []);

  /** Vuelve a la portada: ni categoria abierta ni busqueda escrita. */
  const volverAPortada = () => {
    setCategoriaId(null);
    setQuery("");
    setTecleando(false);
  };

  /** Rejilla de dos columnas; tres cuando la pantalla lo permite. */
  const rejilla = enPanel
    ? "grid grid-cols-2 gap-2 xl:grid-cols-3"
    : "grid grid-cols-2 gap-2 sm:grid-cols-3";

  const enPortada = !buscando && !categoria;

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
            ? "shrink-0 border-b border-line px-3 py-3"
            : "shrink-0 border-b border-line px-3 py-3 pt-safe"
        }
      >
        <div className="flex items-center gap-2">
          {/* Un solo boton de vuelta, siempre en el mismo lugar y siempre con
              el mismo significado: salir de donde estoy. En la portada del
              telefono es la salida de la carta; adentro, la vuelta atras. */}
          {!enPortada ? (
            <button
              type="button"
              onClick={volverAPortada}
              className="flex size-12 shrink-0 items-center justify-center border border-line text-bone"
              aria-label="Volver a las categorías"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          ) : (
            !enPanel && (
              <button
                type="button"
                onClick={onClose}
                className="flex size-12 shrink-0 items-center justify-center border border-line text-bone"
                aria-label="Volver a la cuenta sin enviar"
              >
                <X className="size-5" aria-hidden />
              </button>
            )
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              {buscando
                ? "Buscando en la carta"
                : categoria
                  ? "Categoría"
                  : "Se agrega a la cuenta de"}
            </p>
            <p className="truncate font-display text-lg text-bone">
              {buscando ? query : (categoria?.name ?? dinerLabel)}
            </p>
          </div>
        </div>

        {/*
          Buscar, con el teclado que corresponda a este aparato.

          En el telefono es un campo normal: se toca, sube el teclado del
          sistema —el que el garzon usa todo el dia, que corrige y predice— y
          se escribe. En el mostrador no hay ninguno que subir, asi que ahi el
          campo es un boton que abre el nuestro (ver `keyboard.tsx`).

          Los dos muestran lo escrito y traen la X al lado para vaciarlo, que
          es lo que se quiere cuando la busqueda no dio con nada.
        */}
        <div className="mt-2 flex gap-2">
          {tecladoPropio ? (
            <button
              type="button"
              onClick={() => setTecleando(true)}
              className={[
                "flex h-12 min-w-0 flex-1 items-center gap-2 border px-3 text-left",
                tecleando ? "border-crimson bg-ink" : "border-line bg-ink",
              ].join(" ")}
            >
              <Search className="size-4 shrink-0 text-muted" aria-hidden />
              <span
                className={query ? "truncate text-bone" : "truncate text-muted"}
              >
                {query || "Buscar un producto"}
              </span>
            </button>
          ) : (
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar un producto"
                aria-label="Buscar producto"
                autoComplete="off"
                enterKeyHint="search"
                className="h-12 w-full border border-line bg-ink pl-10 pr-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
              />
            </div>
          )}

          {buscando && (
            <button
              type="button"
              onClick={volverAPortada}
              className="flex size-12 shrink-0 items-center justify-center border border-line text-muted"
              aria-label="Borrar la búsqueda"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="shrink-0 border-b border-crimson/40 bg-crimson/10 px-4 py-2 text-sm text-crimson-bright"
        >
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {/* --- Buscando: una sola lista, la mejor primero. --- */}
        {buscando &&
          (resultados.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted">Nada con ese nombre en la carta.</p>
              <button
                type="button"
                onClick={volverAPortada}
                className="mx-auto mt-4 flex h-12 items-center justify-center gap-2 border border-bone/25 px-5 text-base text-bone"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Ver las categorías
              </button>
            </div>
          ) : (
            <div className={rejilla}>
              {resultados.map((product) => (
                <ProductTile
                  key={`resultado-${product.id}`}
                  product={product}
                  hint={product.category}
                  count={added[product.id] ?? 0}
                  disabled={pending}
                  onAdd={add}
                />
              ))}
            </div>
          ))}

        {/* --- Una categoria: solo sus productos. --- */}
        {!buscando && categoria && (
          <div className={rejilla}>
            {categoria.products.map((product) => (
              <ProductTile
                key={product.id}
                product={product}
                count={added[product.id] ?? 0}
                disabled={pending}
                onAdd={add}
              />
            ))}
          </div>
        )}

        {/* --- Portada: los de siempre y las categorias. --- */}
        {enPortada && (
          <>
            {/* El grueso de los pedidos sale de aca sin buscar ni entrar a
                ninguna categoria: son los veinte productos que se repiten toda
                la noche. */}
            {frequent.length > 0 && (
              <section className="mb-5">
                <h3 className="mb-2 flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-gilt-soft">
                  <Star className="size-3" aria-hidden />
                  Los de siempre
                </h3>

                <div className={rejilla}>
                  {frequent.map((product) => (
                    <ProductTile
                      key={`frecuente-${product.id}`}
                      product={product}
                      count={added[product.id] ?? 0}
                      disabled={pending}
                      onAdd={add}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                La carta
              </h3>

              <div className={rejilla}>
                {menu.map((candidate) => (
                  <CategoryTile
                    key={candidate.id}
                    category={candidate}
                    onOpen={abrirCategoria}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/*
        El pie tiene un solo trabajo por vez.

        Con nuestro teclado abierto, es el teclado: nada mas compite por el
        pulgar. Cerrado —o en un telefono, donde el teclado lo pone el
        sistema— es donde termina de tomarse el pedido.
      */}
      {tecladoPropio && tecleando ? (
        <Keyboard
          onKey={(char) => setQuery((current) => (current + char).slice(0, 40))}
          onBackspace={() => setQuery((current) => current.slice(0, -1))}
          onClear={() => setQuery("")}
          onDone={() => setTecleando(false)}
          doneLabel="Listo"
        />
      ) : onPick ? null : (
        <footer className="shrink-0 border-t border-line bg-ink-soft px-3 py-3 pb-safe">
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
            garzon acaba de cargar los productos y los tiene frescos. Ahora
            envia y vuelve de una. Para salir sin mandar esta la X de la
            cabecera, que es el gesto de siempre para cerrar sin hacer nada.

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
      )}

      {preguntando && (
        <OptionSheet
          product={preguntando}
          dinerLabel={dinerLabel}
          pending={pending}
          onPick={(option) => cargar(preguntando, option)}
          onClose={() => setPreguntando(null)}
        />
      )}

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

/**
 * Una categoria de la portada.
 *
 * Dice cuantos productos tiene: no es adorno, es lo que deja decidir si vale
 * la pena entrar o conviene buscar. Y dice a que estacion va, que es lo que el
 * garzon confirma de reojo antes de cargar.
 */
const CategoryTile = memo(function CategoryTile({
  category,
  onOpen,
}: {
  category: PosMenuCategory;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(category.id)}
      className="flex min-h-24 w-full flex-col justify-between border border-line bg-ink p-3 text-left transition-colors hover:border-crimson active:border-crimson"
    >
      <span className="font-display text-base leading-tight text-bone">
        {category.name}
      </span>

      <span className="mt-2 flex items-center justify-between gap-2 text-[0.65rem] uppercase tracking-[0.12em] text-muted">
        <span>
          {category.products.length}{" "}
          {category.products.length === 1 ? "producto" : "productos"}
        </span>
        <ChevronRight className="size-4 shrink-0" aria-hidden />
      </span>
    </button>
  );
});

/**
 * Un producto.
 *
 * Cuadrado y grande: en un tactil de pie, la recomendacion de no bajar de 44
 * puntos es el piso, no la meta. Cabe el nombre en dos lineas, el precio final
 * y —cuando se acaba de tocar— cuantos van cargados, que es la unica
 * confirmacion que el garzon alcanza a mirar antes del siguiente toque.
 */
const ProductTile = memo(function ProductTile({
  product,
  hint,
  count,
  disabled,
  onAdd,
}: {
  product: PosMenuProduct;
  /** De donde salio, cuando la lista mezcla categorias (la busqueda). */
  hint?: string;
  count: number;
  disabled: boolean;
  onAdd: (product: PosMenuProduct) => void;
}) {
  const final = product.unitPriceCents - product.discountCents;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAdd(product)}
      className="relative flex min-h-24 w-full flex-col justify-between border border-line bg-ink p-3 text-left transition-colors hover:border-crimson active:border-crimson disabled:opacity-60"
    >
      <span className="block text-sm leading-tight text-bone">{product.name}</span>

      <span className="mt-2 block">
        {product.discountCents > 0 && (
          <span className="mb-0.5 block truncate text-[0.6rem] uppercase tracking-[0.12em] text-gilt-soft">
            {product.discountLabel}
          </span>
        )}

        {hint && (
          <span className="mb-0.5 block truncate text-[0.6rem] uppercase tracking-[0.12em] text-muted-dark">
            {hint}
          </span>
        )}

        <span className="font-display text-bone">{formatPrice(final)}</span>
      </span>

      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-emerald-500/25 text-xs font-bold text-emerald-300">
          {count}
        </span>
      )}
    </button>
  );
});
