"use client";

import { Beer, Loader2, Plus, Printer, Send, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { openTable, openWalkIn, sendOrder } from "@/app/actions/pos";
import { Elapsed } from "@/components/staff/pos/elapsed";
import { Keyboard } from "@/components/staff/pos/keyboard";
import { useTecladoPropio } from "@/components/staff/use-pointer";
import { useLiveRefresh } from "@/components/staff/use-live-refresh";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { TableOverview, WalkInOverview } from "@/lib/pos";

/**
 * Estado de la sala.
 *
 * Una mesa libre se abre en dos toques (mesa y cuantos son); una ocupada
 * lleva directo a su cuenta. Todo con el pulgar, que es como se usa esto
 * mientras se camina entre mesas.
 *
 * Cada mesa dice "Libre" u "Ocupada" con todas las letras. El color ya lo
 * indicaba, pero un garzon nuevo no tiene por que saber que el rojo significa
 * ocupada —y quien no distingue bien los colores no lo sabe nunca—. La
 * palabra no le quita nada a la vista rapida y elimina la adivinanza.
 */
export function TableGrid({
  tables,
  walkIns,
  version,
}: {
  tables: TableOverview[];
  /** Las cuentas de gente que no se sento. Van arriba, fuera de la rejilla. */
  walkIns: WalkInOverview[];
  /** Marca del estado de la sala con la que se dibujo esta pantalla. */
  version: string;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState<TableOverview | null>(null);
  const [abriendoDePie, setAbriendoDePie] = useState(false);

  /*
   * La sala se pone al dia sola.
   *
   * Es la unica forma de que funcione el garzon que carga el pedido en su
   * telefono, camina hasta la caja y espera imprimir ahi: si esta pantalla se
   * quedara con lo que habia cuando alguien la toco por ultima vez, llegaria y
   * no veria nada de lo que acaba de cargar.
   *
   * Cada cinco segundos, la mitad que antes: preguntar si algo cambio son
   * unos pocos bytes y una consulta, asi que se puede preguntar mas seguido
   * de lo que antes se podia rearmar. Una mesa que abre un companero aparece
   * aca en cinco segundos como maximo —y al instante si en ese momento se
   * vuelve a mirar el telefono, porque tambien se comprueba al despertar—.
   */
  useLiveRefresh(5_000, { kind: "sala" }, version);

  return (
    <>
      <PorImprimir tables={tables} walkIns={walkIns} />

      <DePie
        walkIns={walkIns}
        onAbrir={() => setAbriendoDePie(true)}
        onEntrar={(sessionId) => router.push(`/staff/pos/${sessionId}`)}
      />

      {tables.length === 0 ? (
        <p className="border border-line bg-ink-soft p-6 text-sm text-muted">
          No hay mesas cargadas. Créalas en el panel, en{" "}
          <strong>Sala → Mesas</strong>. La barra funciona igual: la gente de pie
          no necesita mesas cargadas.
        </p>
      ) : (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {tables.map((table) => {
          const ocupada = table.session !== null;

          return (
            <button
              key={table.id}
              type="button"
              onClick={() =>
                ocupada
                  ? router.push(`/staff/pos/${table.session!.id}`)
                  : setOpening(table)
              }
              className={[
                "flex min-h-28 flex-col justify-between border p-3 text-left transition-colors",
                ocupada
                  ? "border-crimson/50 bg-crimson/10 hover:border-crimson"
                  : "border-line bg-ink-soft hover:border-bone/40",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-2xl text-bone">
                  {table.number}
                </span>

                {ocupada && (
                  <span className="font-display text-lg text-bone">
                    {formatPrice(table.session!.pendingCents)}
                  </span>
                )}
              </div>

              {ocupada ? (
                <div className="mt-2">
                  <p className="text-sm font-medium text-crimson-bright">
                    Ocupada
                  </p>

                  {/*
                    Un solo aviso por mesa, el que manda.

                    La tarjeta llegó a mostrar cuatro renglones —cuántos faltan
                    enviar, cuánto se debe, cuántas comandas esperan, cuántos se
                    sentaron y hace cuánto—, y una sala llena de eso es una
                    pared de texto que no se lee de un vistazo, que es
                    exactamente para lo que sirve la vista de sala. Con la mesa
                    abierta lo urgente es siempre uno solo: si hay algo sin
                    mandar, mandarlo; si no, ir a buscar lo que ya está listo. El
                    resto —cuántos son, hace cuánto— está dentro de la cuenta,
                    a un toque, y ahí sí importa.
                  */}
                  {table.session!.draftItems > 0 ? (
                    <p className="mt-1 text-xs font-medium text-gilt-soft">
                      Falta enviar {table.session!.draftItems}
                    </p>
                  ) : table.session!.pendingTickets > 0 ? (
                    <p className="mt-1 text-xs font-medium text-gilt-soft">
                      {table.session!.pendingTickets === 1
                        ? "1 comanda por retirar"
                        : `${table.session!.pendingTickets} comandas por retirar`}
                    </p>
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      <span className="whitespace-nowrap">
                        {table.session!.diners > 0
                          ? `${table.session!.diners} cuentas`
                          : `${table.session!.guests} personas`}
                        <span aria-hidden> · </span>
                        hace <Elapsed since={table.session!.openedAt} />
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  <span className="mb-0.5 block text-sm font-medium text-bone-dim">
                    Libre
                  </span>
                  {table.name ?? table.zone ?? `${table.seats} lugares`}
                </p>
              )}
            </button>
          );
        })}
      </div>
      )}

      {opening && (
        <OpenTableSheet table={opening} onClose={() => setOpening(null)} />
      )}

      {abriendoDePie && (
        <OpenWalkInSheet onClose={() => setAbriendoDePie(false)} />
      )}
    </>
  );
}

/**
 * La barra: quien esta de pie.
 *
 * Va arriba de la rejilla y no dentro, porque no es una mesa mas: no tiene
 * numero, no tiene lugar en el plano y no siempre existe. En un bar lleno esta
 * es la mitad de la venta, y hasta ahora no tenia donde anotarse.
 *
 * Las dos formas de vender de pie estan como dos botones distintos, y cual usar
 * lo decide el cliente, no el garzon:
 *
 * - **Cobro directo** es para el que pide, paga y se va: se cargan los
 *   productos, se cobra y se entrega, sin cuenta de por medio (ver
 *   `direct-sale.tsx`). No pregunta cuantos son: en una venta que dura un
 *   minuto es un dato que nadie va a leer nunca.
 * - **Abrir cuenta** es para el que se queda. Ahi si hace falta un nombre —"la
 *   de la polera azul"—, que es lo que reemplaza al numero de mesa cuando hay
 *   diez cuentas abiertas contra la barra.
 */
function DePie({
  walkIns,
  onAbrir,
  onEntrar,
}: {
  walkIns: WalkInOverview[];
  onAbrir: () => void;
  onEntrar: (sessionId: string) => void;
}) {
  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg text-bone">
          <Beer className="size-4 text-gilt" aria-hidden />
          De pie
        </h2>

        <div className="flex gap-2">
          {/*
            La venta al paso no abre ninguna cuenta.

            Antes abria una de pie sin nombre y dejaba al garzon en la pantalla
            de la cuenta, que es la de quien se queda: comensales, BarzuCard,
            comandas. Para el que pide una cerveza y paga, eso es una cuenta que
            nace para durar un minuto y una pantalla que ofrece diez cosas que
            no se van a usar. La pantalla del cobro directo hace ese camino
            entero —cargar, cobrar, entregar— sin nada abierto en el medio.
          */}
          <Link
            href="/staff/pos/directo"
            className="flex h-12 items-center gap-2 bg-gilt px-4 text-sm font-medium text-ink"
          >
            <Zap className="size-4" aria-hidden />
            Cobro directo
          </Link>

          <button
            type="button"
            onClick={onAbrir}
            className="flex h-12 items-center gap-2 border border-line px-4 text-sm text-bone"
          >
            <Plus className="size-4" aria-hidden />
            Abrir cuenta
          </button>
        </div>
      </div>

      {walkIns.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Nadie con cuenta abierta en la barra. <strong>Cobro directo</strong> es
          para el que pide y paga al tiro; <strong>Abrir cuenta</strong> la deja
          andando con un nombre.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {walkIns.map(({ title, session }) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onEntrar(session.id)}
                className="flex min-h-28 w-full flex-col justify-between border border-gilt/50 bg-gilt/5 p-3 text-left transition-colors hover:border-gilt"
              >
                <div className="flex items-baseline justify-between gap-2">
                  {/* El nombre es lo que aca hace de numero de mesa: es como el
                      garzon reconoce a quien tiene enfrente. */}
                  <span className="min-w-0 truncate font-display text-lg text-bone">
                    {title}
                  </span>
                  <span className="shrink-0 font-display text-bone">
                    {formatPrice(session.pendingCents)}
                  </span>
                </div>

                {/* El mismo aviso unico que en las mesas, por lo mismo: con la
                    barra llena, cuatro renglones por cuenta no se leen. */}
                {session.draftItems > 0 ? (
                  <p className="mt-1 text-xs font-medium text-gilt-soft">
                    Falta enviar {session.draftItems}
                  </p>
                ) : session.pendingTickets > 0 ? (
                  <p className="mt-1 text-xs font-medium text-gilt-soft">
                    {session.pendingTickets === 1
                      ? "1 comanda por retirar"
                      : `${session.pendingTickets} comandas por retirar`}
                  </p>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Users className="size-3.5 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">
                      {session.diners > 0
                        ? `${session.diners} cuentas`
                        : `${session.guests} personas`}
                      <span aria-hidden> · </span>
                      hace <Elapsed since={session.openedAt} />
                    </span>
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Lo que esta cargado y todavia no se imprimio.
 *
 * Existe para los dos caminos que no pasan por mandar el pedido desde la mesa:
 * el garzon que anota en su telefono mientras atiende y viene a la caja a
 * imprimir todo junto, y el que anota en papel, carga aca de una sentada y
 * recien entonces manda.
 *
 * En los dos casos el gesto final es el mismo —tocar Enviar y estirar la mano
 * a la impresora, que esta al lado— y sin esto habria que buscar la mesa entre
 * veinte casillas para dar ese toque.
 *
 * Solo en la pantalla del local. En el telefono este viaje no existe: el
 * pedido se manda desde la carta, en la mesa, sin caminar a ningun lado.
 */
function PorImprimir({
  tables,
  walkIns,
}: {
  tables: TableOverview[];
  walkIns: WalkInOverview[];
}) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * Mesas y barra en la misma lista, y sin distinguirlas.
   *
   * El viaje que esto resuelve es el mismo para las dos: el garzon cargo en el
   * telefono y viene a la caja a imprimir. Separarlas en dos secciones lo
   * obligaria a mirar en dos lugares para el mismo gesto, justo cuando esta
   * parado al lado de la impresora con la mano estirada.
   */
  const listas = [
    ...tables
      .filter((table) => (table.session?.draftItems ?? 0) > 0)
      .map((table) => ({
        key: table.id,
        title: `Mesa ${table.number}`,
        session: table.session!,
      })),
    ...walkIns
      .filter(({ session }) => session.draftItems > 0)
      .map(({ title, session }) => ({ key: session.id, title, session })),
  ];

  if (listas.length === 0) return null;

  const enviar = (sessionId: string) => {
    setEnviando(sessionId);

    startTransition(async () => {
      const result = await sendOrder(sessionId);
      setEnviando(null);
      setError(result.status === "error" ? (result.message ?? null) : null);
    });
  };

  return (
    <section className="mb-6 hidden border border-gilt/40 bg-gilt/5 p-4 lg:block">
      <h2 className="flex items-center gap-2 text-sm font-medium text-gilt-soft">
        <Printer className="size-4" aria-hidden />
        Cargado y sin imprimir
      </h2>
      <p className="mt-1 text-xs text-muted">
        Toca Enviar y retira el papel de la impresora, aquí al lado.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-crimson-bright">
          {error}
        </p>
      )}

      <ul className="mt-3 flex flex-wrap gap-2">
        {listas.map(({ key, title, session }) => {
          const estaciones = session.draftStations;

          const destino =
            estaciones.length === 1
              ? estaciones[0] === "BARRA"
                ? "a la barra"
                : "a la cocina"
              : "a cocina y barra";

          return (
            <li key={key}>
              <button
                type="button"
                disabled={pending}
                onClick={() => enviar(session.id)}
                className="flex h-14 items-center gap-3 border border-gilt/50 bg-ink-soft px-4 text-left disabled:opacity-50"
              >
                {enviando === session.id ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-gilt" aria-hidden />
                ) : (
                  <Send className="size-5 shrink-0 text-gilt" aria-hidden />
                )}

                <span>
                  <span className="block text-sm text-bone">
                    {title} · Enviar {session.draftItems}
                  </span>
                  <span className="block text-xs text-muted">{destino}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Como se ve quien abre la cuenta.
 *
 * Es la misma convencion que ya usan los comensales dentro de una mesa: no se
 * pide el nombre a nadie —nadie lo da, y menos en una barra— sino como se
 * reconoce a la persona de un vistazo. Estan en botones por la misma razon que
 * las notas rapidas: escribir en un tactil con el local lleno es lo primero que
 * el garzon deja de hacer, y una cuenta sin nombre es una cuenta que despues no
 * se sabe de quien es.
 *
 * Se pueden encadenar —"Polera negra" + "Barba"— tocando dos, que es como se
 * describe a alguien de verdad cuando hay dos poleras negras en la barra.
 */
const DESCRIPCIONES = [
  "Polera negra",
  "Polera blanca",
  "Polera azul",
  "Polera roja",
  "Camisa",
  "Chaqueta",
  "Vestido",
  "Gorro",
  "Pelo largo",
  "Barba",
  "Lentes",
  "Pareja",
  "Grupo",
  "Cumpleaños",
] as const;

/**
 * Abre una cuenta de pie.
 *
 * Pide una sola cosa —como se ve— y ni siquiera la exige: el boton funciona
 * igual sin nombre, porque una cuenta sin nombre sirve mas que un garzon parado
 * escribiendo mientras el cliente espera. Se le puede poner despues.
 *
 * No pregunta cuantas personas son, al reves que una mesa: en la barra el
 * numero no lo sabe nadie —se van sumando amigos— y no cambia nada de como se
 * cobra. Si hace falta repartir la cuenta, para eso estan los comensales
 * adentro, igual que en una mesa.
 */
function OpenWalkInSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");

  const tecladoPropio = useTecladoPropio();
  const [tecleando, setTecleando] = useState(false);

  /** Agrega o quita una descripcion, sin pisar lo que ya estaba escrito. */
  const toggle = (texto: string) => {
    const partes = label
      .split("·")
      .map((parte) => parte.trim())
      .filter(Boolean);

    const indice = partes.findIndex(
      (parte) => parte.toLowerCase() === texto.toLowerCase(),
    );

    if (indice >= 0) partes.splice(indice, 1);
    else partes.push(texto);

    setLabel(partes.join(" · ").slice(0, 40));
  };

  const activo = (texto: string) =>
    label.split("·").some((parte) => parte.trim().toLowerCase() === texto.toLowerCase());

  const submit = () => {
    const formData = new FormData();
    if (label.trim()) formData.set("label", label.trim());

    startTransition(async () => {
      const result = await openWalkIn(IDLE, formData);
      setState(result);

      if (result.status === "success" && result.data?.sessionId) {
        router.push(`/staff/pos/${result.data.sessionId}?nueva=1`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <h2 className="font-display text-xl text-bone">Abrir cuenta de pie</h2>
        <p className="mt-1 text-xs text-muted">
          ¿Cómo se reconoce? Es lo que reemplaza al número de mesa.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {DESCRIPCIONES.map((texto) => (
            <button
              key={texto}
              type="button"
              onClick={() => toggle(texto)}
              aria-pressed={activo(texto)}
              className={[
                "h-11 border px-3 text-sm transition-colors",
                activo(texto)
                  ? "border-gilt bg-gilt/15 text-gilt-soft"
                  : "border-line text-bone-dim",
              ].join(" ")}
            >
              {texto}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
            Cómo se ve
          </span>
          <input
            type="text"
            value={label}
            readOnly={tecladoPropio}
            onChange={(event) => setLabel(event.target.value)}
            onFocus={() => tecladoPropio && setTecleando(true)}
            onClick={() => tecladoPropio && setTecleando(true)}
            maxLength={40}
            placeholder="Polera azul"
            className={[
              "mt-2 h-12 w-full border border-line bg-ink px-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none",
              tecladoPropio ? "cursor-pointer" : "",
            ].join(" ")}
          />
        </label>

        {tecladoPropio && tecleando && (
          <div className="mt-3 -mx-5">
            <Keyboard
              onKey={(char) => setLabel((actual) => (actual + char).slice(0, 40))}
              onBackspace={() => setLabel((actual) => actual.slice(0, -1))}
              onClear={() => setLabel("")}
              onDone={() => setTecleando(false)}
            />
          </div>
        )}

        {state.status === "error" && (
          <p role="alert" className="mt-4 text-sm text-crimson-bright">
            {state.message}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>

          <Button className="flex-1" onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Abrir cuenta"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OpenTableSheet({
  table,
  onClose,
}: {
  table: TableOverview;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [guests, setGuests] = useState(2);

  const submit = () => {
    const formData = new FormData();
    formData.set("tableId", table.id);
    formData.set("guests", String(guests));

    startTransition(async () => {
      const result = await openTable(IDLE, formData);
      setState(result);

      if (result.status === "success" && result.data?.sessionId) {
        router.push(`/staff/pos/${result.data.sessionId}?nueva=1`);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm">
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <h2 className="font-display text-xl text-bone">
          Abrir mesa {table.number}
        </h2>
        <p className="mt-1 text-xs text-muted">¿Cuántas personas se sentaron?</p>

        <div className="mt-5 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => setGuests((value) => Math.max(1, value - 1))}
            className="flex size-14 items-center justify-center border border-line text-2xl text-bone"
            aria-label="Menos personas"
          >
            −
          </button>

          <span className="font-display text-5xl text-bone" aria-live="polite">
            {guests}
          </span>

          <button
            type="button"
            onClick={() => setGuests((value) => Math.min(40, value + 1))}
            className="flex size-14 items-center justify-center border border-line text-2xl text-bone"
            aria-label="Más personas"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>

        {state.status === "error" && (
          <p role="alert" className="mt-4 text-sm text-crimson-bright">
            {state.message}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>

          <Button className="flex-1" onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Abrir mesa"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
