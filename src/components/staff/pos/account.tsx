"use client";

import {
  ArrowLeft,
  Ban,
  CreditCard,
  Gift,
  Loader2,
  MessageSquarePlus,
  Minus,
  PackageCheck,
  Plus,
  RotateCw,
  Send,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  addDiner,
  cancelItem,
  closeTable,
  detachCard,
  markTicketPickedUp,
  removeDiner,
  removePromotion,
  reprintTicket,
  sendOrder,
  setItemQuantity,
} from "@/app/actions/pos";
import { AssignSheet } from "@/components/staff/pos/assign-sheet";
import { CardSheet } from "@/components/staff/pos/card-sheet";
import { ConfirmSheet } from "@/components/staff/pos/confirm-sheet";
import { Keyboard } from "@/components/staff/pos/keyboard";
import { Elapsed } from "@/components/staff/pos/elapsed";
import { PromoSheet } from "@/components/staff/pos/promo-sheet";
import { NoteSheet } from "@/components/staff/pos/note-sheet";
import { PaySheet } from "@/components/staff/pos/pay-sheet";
import { ProductPicker } from "@/components/staff/pos/product-picker";
import { useLiveRefresh } from "@/components/staff/use-live-refresh";
import { useTecladoPropio } from "@/components/staff/use-pointer";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type {
  AccountItem,
  AccountTab,
  PosMenuCategory,
  PosMenuProduct,
  PromotionOffer,
  SessionDetail,
} from "@/lib/pos";

/**
 * La cuenta de una mesa.
 *
 * La mesa se reparte en pestanas: una por comensal, mas la de lo compartido.
 * Cada pestana se cobra sola, y tambien se puede cobrar todo junto — que son
 * las dos formas en las que realmente se paga en un bar.
 */
export function Account({
  session,
  menu,
  frequent,
  offers,
  version,
  autoOpenPicker = false,
}: {
  session: SessionDetail;
  menu: PosMenuCategory[];
  frequent: PosMenuProduct[];
  /** Beneficios ya resueltos por pestaña ("mesa" = la cuenta compartida). */
  offers: Record<string, PromotionOffer[]>;
  /** Marca del estado de la cuenta con la que se dibujo esta pantalla. */
  version: string;
  /** Mesa recien abierta: se entra directo a cargar, sin un toque de mas. */
  autoOpenPicker?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [picker, setPicker] = useState(autoOpenPicker);
  const [noting, setNoting] = useState<AccountItem | null>(null);
  const [assigning, setAssigning] = useState<AccountItem | null>(null);
  const [paying, setPaying] = useState<"tab" | "table" | null>(null);
  const [addingDiner, setAddingDiner] = useState(false);
  const [scanningCard, setScanningCard] = useState(false);
  const [choosingPromo, setChoosingPromo] = useState(false);
  const [feedback, setFeedback] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  /* Confirmaciones de lo que no se puede deshacer. */
  const [cancelling, setCancelling] = useState<AccountItem | null>(null);
  const [removingDiner, setRemovingDiner] = useState<AccountTab | null>(null);
  const [closing, setClosing] = useState(false);
  const [choosingPayer, setChoosingPayer] = useState(false);

  /*
   * La cuenta tambien se pone al dia sola.
   *
   * Una misma mesa se mira desde el telefono del garzon y desde la pantalla de
   * la caja al mismo tiempo, y lo que uno carga el otro tiene que verlo: el que
   * viene a imprimir necesita encontrar aca lo que cargo caminando, y el que
   * sigue en la mesa necesita enterarse de que en la caja ya le cobraron.
   *
   * Un poco mas espaciado que la sala: esta pantalla se toca todo el rato, y
   * cada toque ya la actualiza por su cuenta.
   */
  useLiveRefresh(8_000, { kind: "cuenta", sessionId: session.id }, version);

  const tab =
    session.tabs.find((candidate) => candidate.dinerId === activeTab) ??
    session.tabs[0];

  const run = (action: () => Promise<FormState>) => {
    startTransition(async () => setFeedback(await action()));
  };

  const cerrada = session.status === "CLOSED";

  /** Hay productos cargados que cocina y barra todavia no recibieron. */
  const hayPorEnviar = session.draftCount > 0;

  /**
   * Consumo que todavia no quedo en ningun cobro.
   *
   * Se cuenta por lineas, no por plata: una cuenta puede sumar cero —todo de
   * cortesia, o un beneficio que la cubre entera— y aun asi tener productos
   * que hay que registrar antes de cerrar. Es la misma regla que aplica el
   * servidor al cerrar, escrita aca para que los botones no ofrezcan algo que
   * despues se rechaza.
   */
  const haySinCobrar = session.tabs.some((candidate) =>
    candidate.items.some((item) => !item.paid),
  );

  /** La mesa se abrio y nunca se le cargo nada. */
  const sinConsumo = session.tabs.every(
    (candidate) => candidate.items.length === 0,
  );

  /**
   * A donde va lo que falta enviar.
   *
   * El boton nombra el destino real —"a la cocina", "a la barra" o a las dos—
   * en vez de decir siempre lo mismo. Un garzon que carga solo tragos y lee
   * "enviar a cocina" duda de si toco donde debia.
   */
  const destinoPorEnviar = (() => {
    const stations = new Set(
      session.tabs.flatMap((candidate) =>
        candidate.items
          .filter((item) => item.status === "DRAFT")
          .map((item) => item.station),
      ),
    );

    if (stations.size === 1) {
      return stations.has("BARRA") ? "a la barra" : "a la cocina";
    }
    return "a cocina y barra";
  })();

  /** Comandas que siguen en cocina o barra esperando que alguien las lleve. */
  const pendientes = session.tickets.filter((ticket) => ticket.pendiente);

  /** Papeles que la impresora no logro sacar. Es lo unico del registro de
      impresion que obliga a hacer algo. */
  const fallidas = session.tickets.filter(
    (ticket) => ticket.status === "FAILED",
  );

  /** La mesa esta repartida entre varias personas. */
  const cuentaSeparada = session.diners.length > 0;

  /** Beneficios que esta pestaña puede usar ahora mismo. */
  const ofertas = offers[tab.dinerId ?? "mesa"] ?? [];
  const disponibles = ofertas.filter((offer) => offer.available).length;

  /**
   * Abre el cobro.
   *
   * Con la mesa entera para una sola persona no hay nada que preguntar. Con la
   * cuenta separada si: antes el boton elegia solo —cobraba la pestaña abierta
   * si tenia saldo y si no la mesa entera— y esa decision, que define quien
   * paga cuanto, quedaba escondida en una condicion.
   */
  /**
   * Manda lo cargado a cocina y barra.
   *
   * Se llama desde los dos lados —la barra de acciones de la cuenta y el pie
   * de la carta en el telefono— porque son el mismo gesto hecho desde donde
   * cada uno esta parado. Cierra la carta: mandar el pedido es el final de
   * tomarlo, y lo que sigue mirando el garzon es la cuenta.
   */
  const enviarPedido = () => {
    startTransition(async () => {
      setFeedback(await sendOrder(session.id));
      setPicker(false);
    });
  };

  const startPayment = () => {
    if (cuentaSeparada) {
      setChoosingPayer(true);
      return;
    }
    setPaying("table");
  };

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink pt-safe">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-none">
          <Link
            href="/staff/pos"
            aria-label="Volver a la sala"
            className="flex size-10 shrink-0 items-center justify-center border border-line text-bone"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <div className="min-w-0 flex-1">
            {/* "Mesa 4" o "Polera azul": lo resuelve el servidor, porque lo
                mismo tiene que decir el papel de la comanda y la pantalla de
                barra (ver `sessionTitle`). */}
            <h1 className="font-display text-xl text-bone">
              {session.title}
              {session.table?.name && (
                <span className="ml-2 text-sm text-muted">
                  {session.table.name}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted">
              {session.guests} personas
              {cerrada && (
                <span className="ml-2 text-bone-dim">· Mesa cerrada</span>
              )}
            </p>
          </div>

          {/* "Pendiente" es palabra de sistema. Lo que el garzon necesita
              saber, y lo que le va a preguntar el cliente, es cuanto falta. */}
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Falta pagar</p>
            <p className="font-display text-xl text-bone">
              {formatPrice(session.pendingCents)}
            </p>
          </div>
        </div>
      </header>

      {/*
        Dos columnas en la pantalla tactil del local, una sola en el telefono.

        En un POS de mostrador la carta no deberia ser una ventana que se abre
        y se cierra: es el gesto que mas se repite en toda la noche. Con la
        pantalla apaisada sobra el ancho para tenerla fija a la derecha, y asi
        el garzon ve al mismo tiempo lo que va cargando y como queda la cuenta.
        En el telefono no cabe, y ahi se sigue abriendo a pantalla completa.
      */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 lg:max-w-none lg:px-6">
            {feedback.message && (
              <p
                role="status"
                className={[
                  "mb-4 border px-4 py-2 text-sm",
                  feedback.status === "error"
                    ? "border-crimson/40 bg-crimson/10 text-crimson-bright"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
                ].join(" ")}
              >
                {feedback.message}
              </p>
            )}

            {/*
              Lo que hay que ir a hacer, arriba de todo.

              Antes esto vivia al fondo de la pantalla, despues del consumo y
              de la tarjeta: el garzon tenia que desplazarse para enterarse de
              que la cocina lo estaba esperando. Es la unica parte de la cuenta
              que le pide moverse, asi que va primero y en una sola linea.
            */}
            {!cerrada && (pendientes.length > 0 || fallidas.length > 0) && (
              <ul className="mb-4 flex flex-col gap-2">
                {pendientes.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex items-center justify-between gap-3 border border-gilt/40 bg-gilt/5 px-3 py-2"
                  >
                    <span className="min-w-0 text-sm text-bone">
                      Lista en {ticket.station === "BARRA" ? "la barra" : "la cocina"}{" "}
                      <span className="text-muted">
                        · hace <Elapsed since={ticket.createdAt} />
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => markTicketPickedUp(ticket.id))}
                      className="flex h-11 shrink-0 items-center gap-2 border border-bone/25 px-4 text-sm text-bone disabled:opacity-50"
                    >
                      <PackageCheck className="size-4" aria-hidden />
                      Ya la retiré
                    </button>
                  </li>
                ))}

                {fallidas.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex items-center justify-between gap-3 border border-crimson/40 bg-crimson/10 px-3 py-2"
                  >
                    <span className="min-w-0 text-sm text-crimson-bright">
                      No salió el papel de{" "}
                      {ticket.kind === "COBRO"
                        ? "el cobro"
                        : ticket.station === "BARRA"
                          ? "la barra"
                          : "la cocina"}
                    </span>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => reprintTicket(ticket.id))}
                      className="flex h-11 shrink-0 items-center gap-2 border border-bone/25 px-4 text-sm text-bone disabled:opacity-50"
                    >
                      <RotateCw className="size-4" aria-hidden />
                      Reintentar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Pestanas: solo cuando la cuenta esta dividida. Con una mesa normal
                —que es la mayoria— serian una fila de ruido. */}
            {session.diners.length > 0 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2">
              {session.tabs.map((candidate) => {
                const active = candidate.dinerId === tab.dinerId;

                return (
                  <button
                    key={candidate.dinerId ?? "mesa"}
                    type="button"
                    onClick={() => setActiveTab(candidate.dinerId)}
                    className={[
                      "flex shrink-0 flex-col items-start border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-crimson bg-crimson/12"
                        : "border-line bg-ink-soft",
                    ].join(" ")}
                  >
                    <span className="whitespace-nowrap text-sm text-bone">
                      {candidate.label}
                    </span>
                    <span className="text-[0.65rem] text-muted">
                      {formatPrice(candidate.pendingCents)}
                      {candidate.paidCents > 0 && (
                        <span className="ml-1 text-emerald-300">
                          · {formatPrice(candidate.paidCents)} pagado
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}

              {!cerrada && (
                <button
                  type="button"
                  onClick={() => setAddingDiner(true)}
                  className="flex shrink-0 items-center gap-2 border border-dashed border-line px-3 py-2 text-sm text-muted"
                >
                  <UserPlus className="size-4" aria-hidden />
                  Otra persona
                </button>
              )}
            </div>
            )}

            {addingDiner && (
              <DinerForm
                sessionId={session.id}
                onDone={(result) => {
                  setFeedback(result);
                  setAddingDiner(false);
                }}
                onCancel={() => setAddingDiner(false)}
              />
            )}

            {/* Consumo de la pestana activa */}
            <section className="mt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg text-bone">{tab.label}</h2>

                {tab.dinerId && !cerrada && (
                  <button
                    type="button"
                    onClick={() => setRemovingDiner(tab)}
                    className="text-sm text-muted underline underline-offset-4 hover:text-crimson-bright"
                  >
                    Quitar a {tab.label}
                  </button>
                )}

                {session.diners.length === 0 && !cerrada && (
                  <button
                    type="button"
                    onClick={() => setAddingDiner(true)}
                    className="flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 hover:text-bone"
                  >
                    <UserPlus className="size-4" aria-hidden />
                    Separar cuentas
                  </button>
                )}
              </div>

              {tab.items.length === 0 ? (
                /* Una mesa vacia no es un error: es el momento de tomar el
                   pedido. En vez de informar el vacio, se ofrece la salida. */
                <div className="mt-3 border border-line bg-ink-soft p-5 text-center">
                  <p className="text-sm text-muted">
                    Todavía no hay nada cargado en esta cuenta.
                  </p>
                  {/* Igual que el de la barra de acciones: en pantalla grande
                      la carta ya esta al lado y este boton abriria una ventana
                      que ahi no se muestra. */}
                  {!cerrada && (
                    <button
                      type="button"
                      onClick={() => setPicker(true)}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 border border-bone/25 text-base text-bone lg:hidden"
                    >
                      <Plus className="size-4" aria-hidden />
                      Agregar productos
                    </button>
                  )}
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {tab.items.map((item) => (
                    <li
                      key={item.id}
                      className={[
                        "border px-3 py-2.5",
                        item.paid
                          ? "border-line/60 bg-ink-soft/40 opacity-70"
                          : "border-line bg-ink-soft",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-bone">
                            <span className="text-muted">{item.quantity}×</span>{" "}
                            {item.name}
                            {/* Lo elegido va pegado al nombre y no entre los
                                avisos de abajo: es parte de que se vendio, y
                                asi se lee "Promo con bebida · Sprite" de una. */}
                            {item.variant && (
                              <span className="text-gilt-soft"> · {item.variant}</span>
                            )}
                          </p>

                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                            <span className="text-muted">
                              {item.station === "BARRA" ? "Barra" : "Cocina"}
                            </span>

                            {/* Lo que importa de un producto es si el que lo
                                prepara ya se entero. "Sin mandar" no lo decia. */}
                            {item.status === "DRAFT" && (
                              <span className="text-gilt-soft">
                                Falta enviar a{" "}
                                {item.station === "BARRA" ? "la barra" : "la cocina"}
                              </span>
                            )}

                            {item.paid && (
                              <span className="text-emerald-300">Ya pagado</span>
                            )}

                            {item.discountCents > 0 && (
                              <span className="text-gilt-soft">
                                {item.discountLabel}
                              </span>
                            )}
                          </p>

                          {item.note && (
                            <p className="mt-1 text-xs text-bone-dim">{item.note}</p>
                          )}
                        </div>

                        <p className="shrink-0 font-display text-bone">
                          {formatPrice(item.totalCents)}
                        </p>
                      </div>

                      {!item.paid && !cerrada && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.status === "DRAFT" ? (
                            <>
                              <QuantityButton
                                label="Quitar uno"
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    setItemQuantity(item.id, item.quantity - 1),
                                  )
                                }
                              >
                                <Minus className="size-4" aria-hidden />
                              </QuantityButton>

                              <QuantityButton
                                label="Agregar uno"
                                disabled={pending}
                                onClick={() =>
                                  run(() =>
                                    setItemQuantity(item.id, item.quantity + 1),
                                  )
                                }
                              >
                                <Plus className="size-4" aria-hidden />
                              </QuantityButton>
                            </>
                          ) : (
                            /* Ya salio hacia la cocina: borrarlo sin preguntar
                               era un toque de distancia y no tiene vuelta. */
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setCancelling(item)}
                              className="flex h-10 items-center gap-1.5 border border-line px-3 text-sm text-muted hover:border-crimson hover:text-crimson-bright"
                            >
                              <Ban className="size-4" aria-hidden />
                              Anular
                            </button>
                          )}

                          {/* Con la cuenta separada, de quien es cada producto
                              es parte de la linea y se cambia ahi mismo: es lo
                              unico que decide despues quien paga que. */}
                          {cuentaSeparada && (
                            <button
                              type="button"
                              onClick={() => setAssigning(item)}
                              className="flex h-10 items-center gap-1.5 border border-line px-3 text-sm text-muted hover:border-crimson hover:text-bone"
                            >
                              <Users className="size-4" aria-hidden />
                              ¿De quién?
                            </button>
                          )}

                          {/* La nota se puede poner tambien despues de enviarlo:
                              mientras la cocina no lo empiece, avisar es mejor
                              que anular y volver a pedir. */}
                          <button
                            type="button"
                            onClick={() => setNoting(item)}
                            className={[
                              "ml-auto flex h-10 items-center gap-1.5 border px-3 text-sm",
                              item.note
                                ? "border-gilt/50 text-gilt-soft"
                                : "border-line text-muted",
                            ].join(" ")}
                          >
                            <MessageSquarePlus className="size-4" aria-hidden />
                            Nota
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Lo que descuenta la BarzuCard en esta cuenta. Va pegado al
                  consumo y no al pie: es parte de lo que se lee en voz alta
                  cuando el cliente pregunta cuanto es. */}
              {tab.promotions.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {tab.promotions.map((promotion) => (
                    <li
                      key={promotion.redemptionId}
                      className="flex items-center justify-between gap-3 border border-emerald-500/40 bg-emerald-500/5 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-bone">
                          <Gift className="size-4 shrink-0 text-emerald-300" aria-hidden />
                          {promotion.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {promotion.missing
                            ? "Ya no aplica: el producto salió de la cuenta"
                            : promotion.detail || "Beneficio BarzuCard"}
                          {" · "}
                          {promotion.receiptCode}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <p className="font-display text-emerald-300">
                          −{formatPrice(promotion.discountCents)}
                        </p>

                        {!cerrada && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => removePromotion(promotion.redemptionId))
                            }
                            aria-label={`Quitar ${promotion.title}`}
                            className="flex size-10 items-center justify-center border border-line text-muted hover:border-crimson hover:text-crimson-bright"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/*
              BarzuCard de la mesa.

              El programa entero cuelga de este bloque: sin tarjeta presentada
              no hay beneficio posible, y por eso el boton esta a la vista
              desde el primer momento en vez de escondido en el cobro —que es
              donde estaba y donde ya no sirve de nada, porque el cliente pide
              su descuento cuando pide, no cuando paga—.
            */}
            {!cerrada && (
              <section className="mt-6">
                {session.card ? (
                  /* Con la tarjeta ya presentada, lo unico que se hace de aca
                     en adelante es aplicar beneficios: el boton es la fila
                     entera, y el nombre del socio va debajo como respaldo de
                     que se leyo la tarjeta correcta. */
                  <>
                    <button
                      type="button"
                      onClick={() => setChoosingPromo(true)}
                      className="flex h-12 w-full items-center justify-center gap-2 border border-gilt/50 bg-gilt/10 text-base text-gilt-soft"
                    >
                      <Gift className="size-5" aria-hidden />
                      Aplicar un beneficio
                      {disponibles > 0 && (
                        <span className="rounded-full bg-gilt px-2 py-0.5 text-sm font-medium text-ink">
                          {disponibles}
                        </span>
                      )}
                    </button>

                    <p className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <CreditCard className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                          {session.card.memberName} · ••••
                          {session.card.cardNumber.slice(-4)}
                        </span>
                      </span>

                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => detachCard(session.id))}
                        className="shrink-0 underline underline-offset-4 hover:text-crimson-bright"
                      >
                        No es esta
                      </button>
                    </p>
                  </>
                ) : (
                  /* Sin tarjeta el bloque es una sola linea: el programa tiene
                     que estar a la vista al pedir —el cliente reclama el
                     descuento cuando pide, no cuando paga— pero no compite en
                     tamaño con enviar y cobrar. */
                  <button
                    type="button"
                    onClick={() => setScanningCard(true)}
                    className="flex h-12 w-full items-center justify-center gap-2 border border-dashed border-gilt/40 text-sm text-gilt-soft"
                  >
                    <CreditCard className="size-4" aria-hidden />
                    ¿Tiene BarzuCard?
                  </button>
                )}
              </section>
            )}

            {/*
              Cierre: cuando no queda consumo sin cobrar.

              Antes tambien exigia que se hubiera cobrado algo, y por eso una
              mesa abierta por error —el clasico toque de mas, o el grupo que
              se levanta antes de pedir— se quedaba ocupada para siempre: sin
              productos no habia nada que cobrar, y sin cobro no aparecia este
              boton. Una mesa sin consumo es justamente la mas facil de cerrar.
            */}
            {!cerrada && !haySinCobrar && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setClosing(true)}
                className="mt-8 h-12 w-full border border-line text-base text-muted hover:border-crimson hover:text-crimson-bright"
              >
                {sinConsumo
                  ? "Cerrar la mesa sin consumo"
                  : "Cerrar la mesa y dejarla libre"}
              </button>
            )}

            {/*
              El registro de impresion, guardado y solo en la caja.

              Antes era una lista abierta con cada papel de la noche y un boton
              de reimprimir en cada uno. Un garzon nunca necesita saber que la
              comanda N°14 se imprimio bien: si algo no salio ya se lo dijimos
              arriba, en rojo y con el boton al lado. Lo que si pasa —y solo en
              la caja— es que el cliente pide de nuevo el papel del cobro. Para
              eso queda esto, cerrado, en la pantalla del local.
            */}
            {session.tickets.length > 0 && (
              <details className="mt-8 hidden lg:block">
                <summary className="cursor-pointer text-sm text-muted">
                  Volver a imprimir un papel
                </summary>

                <ul className="mt-2 flex flex-col gap-1.5">
                  {session.tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex items-center justify-between gap-3 border border-line bg-ink-soft px-3 py-2 text-sm"
                    >
                      {/* El resumen del cobro sale por la misma cola pero no
                          va a ninguna estacion: se nombra por lo que es. */}
                      <span className="text-bone-dim">
                        {ticket.kind === "COBRO"
                          ? "Resumen del cobro"
                          : ticket.station === "BARRA"
                            ? "Barra"
                            : "Cocina"}{" "}
                        · N°{ticket.number}
                      </span>

                      <button
                        type="button"
                        disabled={pending || ticket.status === "PENDING"}
                        onClick={() => run(() => reprintTicket(ticket.id))}
                        className="flex h-9 items-center gap-1.5 border border-line px-3 text-sm text-muted hover:border-crimson hover:text-crimson-bright disabled:opacity-40"
                      >
                        <RotateCw className="size-3.5" aria-hidden />
                        Reimprimir
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </main>

          {/*
            Barra de acciones: siempre bajo el pulgar, nunca flotando.

            Antes habia un solo boton que cambiaba de identidad: decia "Mandar"
            mientras hubiera algo sin enviar y "Cobrar" cuando no. Dos acciones
            muy distintas —una avisa a la cocina, la otra recibe plata— turnandose
            en el mismo lugar, sin decir por que. Peor todavia: al desaparecer
            "Cobrar", el garzon no tenia forma de saber si el sistema no lo dejaba
            cobrar o si el boton se habia movido.

            Ahora cada accion tiene su lugar fijo. Cuando cobrar no corresponde,
            el boton sigue ahi, apagado y con el motivo escrito al lado.
          */}
          {!cerrada && (
            <div className="shrink-0 border-t border-line bg-ink pb-safe">
              {hayPorEnviar && (
                <p className="mx-auto max-w-2xl px-4 pt-3 text-sm text-gilt-soft lg:max-w-none">
                  {session.draftCount === 1
                    ? "Hay 1 producto que"
                    : `Hay ${session.draftCount} productos que`}{" "}
                  {destinoPorEnviar === "a la barra" ? "la barra" : "la cocina"}{" "}
                  todavía no {session.draftCount === 1 ? "vio" : "vieron"}. Envía
                  antes de cobrar.
                </p>
              )}

              <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 lg:max-w-none">
                {/* Con la carta fija al lado, este boton no lleva a ningun
                    lado: se esconde en pantalla grande. */}
                <button
                  type="button"
                  onClick={() => setPicker(true)}
                  className="flex h-14 flex-1 items-center justify-center gap-2 border border-bone/25 text-base text-bone lg:hidden"
                >
                  <Plus className="size-5" aria-hidden />
                  Agregar
                </button>

                {hayPorEnviar ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={enviarPedido}
                    className="flex h-14 flex-[1.6] items-center justify-center gap-2 bg-gilt text-base font-medium text-ink disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-5" aria-hidden />
                    )}
                    Enviar {session.draftCount} {destinoPorEnviar}
                  </button>
                ) : (
                  /* Se habilita por consumo sin cobrar, no por monto: una
                     cuenta que quedo en cero por beneficios igual tiene que
                     pasar por el cobro para poder cerrarse. */
                  <button
                    type="button"
                    disabled={!haySinCobrar}
                    onClick={startPayment}
                    className="flex h-14 flex-[1.6] items-center justify-center gap-2 bg-crimson text-base font-medium text-bone disabled:opacity-40"
                  >
                    <Wallet className="size-5" aria-hidden />
                    {!haySinCobrar
                      ? sinConsumo
                        ? "Nada que cobrar"
                        : "Todo pagado"
                      : `Cobrar ${formatPrice(session.pendingCents)}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* La carta, fija, solo cuando hay ancho de sobra. */}
        {!cerrada && (
          <aside className="hidden w-[28rem] shrink-0 border-l border-line lg:block xl:w-[34rem]">
            <ProductPicker
              variant="panel"
              sessionId={session.id}
              dinerId={tab.dinerId}
              dinerLabel={tab.label}
              menu={menu}
              frequent={frequent}
              onClose={() => setPicker(false)}
            />
          </aside>
        )}
      </div>

      {/* En el telefono, la misma carta a pantalla completa — y con el envio
          en el pie, que ahi es donde termina de tomarse el pedido. */}
      {picker && (
        <div className="lg:hidden">
          <ProductPicker
            sessionId={session.id}
            dinerId={tab.dinerId}
            dinerLabel={tab.label}
            menu={menu}
            frequent={frequent}
            draftCount={session.draftCount}
            destino={destinoPorEnviar}
            onSend={enviarPedido}
            sending={pending}
            onClose={() => setPicker(false)}
          />
        </div>
      )}

      {scanningCard && (
        <CardSheet
          sessionId={session.id}
          onClose={() => setScanningCard(false)}
        />
      )}

      {choosingPromo && (
        <PromoSheet
          sessionId={session.id}
          dinerId={tab.dinerId}
          tabLabel={tab.dinerId ? tab.label : "la mesa"}
          offers={ofertas}
          onClose={() => setChoosingPromo(false)}
        />
      )}

      {assigning && (
        <AssignSheet
          item={assigning}
          tabs={session.tabs}
          onDone={setFeedback}
          onClose={() => setAssigning(null)}
        />
      )}

      {noting && (
        <NoteSheet
          itemId={noting.id}
          itemName={noting.name}
          current={noting.note}
          onClose={() => setNoting(null)}
        />
      )}

      {paying && (
        <PaySheet
          sessionId={session.id}
          tab={paying === "tab" ? tab : null}
          totalCents={
            paying === "tab" ? tab.pendingCents : session.pendingCents
          }
          discountCents={
            paying === "tab"
              ? tab.promotionDiscountCents
              : session.tabs.reduce(
                  (total, candidate) => total + candidate.promotionDiscountCents,
                  0,
                )
          }
          onClose={() => setPaying(null)}
        />
      )}

      {/* Con la cuenta separada, a quien se le cobra es una pregunta, no una
          deduccion del sistema. */}
      {choosingPayer && (
        <PayerSheet
          tabs={session.tabs}
          tablePendingCents={session.pendingCents}
          onPick={(who) => {
            setChoosingPayer(false);

            if (who === "table") {
              setPaying("table");
              return;
            }

            /* La pestaña elegida pasa a ser la abierta: el cobro se arma con
               ella, y al volver la cuenta queda mostrando a quien se le cobro. */
            setActiveTab(who.dinerId);
            setPaying("tab");
          }}
          onClose={() => setChoosingPayer(false)}
        />
      )}

      {cancelling && (
        <ConfirmSheet
          title={`¿Anular ${cancelling.name}?`}
          detail="Ya salió hacia la cocina o la barra. Anúlalo solo si además vas a avisarles, porque el papel ya está impreso allá."
          confirmLabel="Sí, anular"
          onConfirm={() => run(() => cancelItem(cancelling.id))}
          onClose={() => setCancelling(null)}
        />
      )}

      {removingDiner && (
        <ConfirmSheet
          title={`¿Quitar a ${removingDiner.label}?`}
          detail="Lo que haya consumido vuelve a la cuenta general de la mesa. No se borra nada de lo pedido."
          confirmLabel="Sí, quitar"
          onConfirm={() => run(() => removeDiner(removingDiner.dinerId!))}
          onClose={() => setRemovingDiner(null)}
        />
      )}

      {closing && (
        <ConfirmSheet
          title={
            session.table
              ? `¿Cerrar la mesa ${session.table.number}?`
              : `¿Cerrar la cuenta de ${session.title}?`
          }
          detail={
            sinConsumo
              ? "No se cargó ningún producto, así que no queda nada por cobrar. La mesa vuelve a quedar libre."
              : "Queda libre para los próximos clientes y ya no se le puede agregar nada. Está todo pagado."
          }
          confirmLabel={session.table ? "Sí, cerrar la mesa" : "Sí, cerrar la cuenta"}
          onConfirm={() => run(() => closeTable(session.id))}
          onClose={() => setClosing(false)}
        />
      )}
    </>
  );
}

/**
 * ¿Quien paga?
 *
 * Solo aparece con la cuenta separada. Estan todas las pestañas con su monto,
 * no solo la que quedo abierta: quien paga se decide en la mesa —"yo pago lo
 * mio", dice Victor— y el garzon tiene que poder tocar ese nombre sin volver
 * atras a buscar la pestaña. Y porque los montos son lo que hay que cantar en
 * voz alta antes de pasar la maquina.
 *
 * Una pestaña sin nada que cobrar sale apagada y con el motivo escrito: sin
 * eso, un boton muerto se lee como que el sistema no deja cobrarle a esa
 * persona, cuando lo que pasa es que su consumo todavia esta en la cuenta de
 * la mesa.
 */
function PayerSheet({
  tabs,
  tablePendingCents,
  onPick,
  onClose,
}: {
  tabs: AccountTab[];
  tablePendingCents: number;
  onPick: (who: AccountTab | "table") => void;
  onClose: () => void;
}) {
  /** Alguien tiene consumo sin cobrar todavia en la cuenta compartida. */
  const hayEnLaMesa = tabs.some(
    (tab) => tab.dinerId === null && tab.items.some((item) => !item.paid),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="¿Quién paga?"
      className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80"
    >
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <h2 className="font-display text-xl text-bone">¿Quién paga ahora?</h2>
        <p className="mt-2 text-sm text-muted">
          Cobrar a una persona no cierra la mesa: los demás siguen consumiendo.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {tabs.map((tab) => {
            const sinCobrar = tab.items.some((item) => !item.paid);

            return (
              <button
                key={tab.dinerId ?? "mesa"}
                type="button"
                disabled={!sinCobrar}
                onClick={() => onPick(tab)}
                className="flex min-h-16 w-full items-center justify-between gap-3 border border-line px-4 text-left disabled:opacity-40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base text-bone">
                    {tab.dinerId ? `Solo ${tab.label}` : "Solo lo compartido"}
                  </span>

                  {!sinCobrar && (
                    <span className="block text-xs text-muted">
                      {tab.items.length === 0
                        ? "Sin consumo asignado. Usa “¿De quién?” en cada producto."
                        : "Ya está todo cobrado."}
                    </span>
                  )}
                </span>

                <span className="shrink-0 font-display text-lg text-bone">
                  {formatPrice(tab.pendingCents)}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPick("table")}
            className="flex min-h-16 w-full items-center justify-between gap-3 border border-line px-4 text-left"
          >
            <span className="text-base text-bone">Toda la mesa</span>
            <span className="shrink-0 font-display text-lg text-bone">
              {formatPrice(tablePendingCents)}
            </span>
          </button>

          {/* Lo compartido no se reparte solo: cobrar a una persona deja ese
              consumo pendiente, y conviene saberlo antes de cobrar y no
              despues, con el cliente ya de pie. */}
          {hayEnLaMesa && (
            <p className="mt-1 text-xs text-muted">
              Lo que está en la cuenta compartida no entra en el cobro de una
              persona: queda pendiente para la mesa.
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-2 h-14 w-full border border-line text-base text-bone-dim"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}

function QuantityButton({
  label,
  children,
  ...props
}: {
  label: string;
  children: React.ReactNode;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-10 items-center justify-center border border-line text-bone disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Alta de un comensal.
 *
 * Se describe por como se ve, no por su nombre: en una mesa de desconocidos
 * "polera azul" es util y preguntar el nombre es incomodo.
 */
function DinerForm({
  sessionId,
  onDone,
  onCancel,
}: {
  sessionId: string;
  onDone: (result: FormState) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  /* El mostrador no levanta el teclado del sistema; el telefono si, y ahi el
     suyo es mejor que el nuestro (ver `use-pointer`). */
  const tecladoPropio = useTecladoPropio();

  const submit = () => {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("label", label);

    startTransition(async () => {
      const result = await addDiner(IDLE, formData);
      if (result.status === "success") setLabel("");
      onDone(result);
    });
  };

  return (
    <div className="mt-3 border border-line bg-ink-soft p-4">
      <label className="block">
        <span className="text-sm text-bone">
          ¿Cómo reconoces a esta persona?
        </span>
        <span className="mt-1 block text-xs text-muted">
          Sirve para separar su consumo y cobrarle aparte. Descríbela por la
          ropa o el lugar en la mesa; no hace falta preguntarle el nombre.
        </span>
        {/* En el mostrador es de solo lectura y se escribe con el teclado de
            abajo, porque ahi no hay ninguno del sistema que aparezca al
            enfocar. En un telefono es un campo normal. */}
        <input
          type="text"
          value={label}
          readOnly={tecladoPropio}
          autoFocus={!tecladoPropio}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={40}
          placeholder="Polera azul, pelo largo…"
          className="mt-2 h-12 w-full border border-line bg-ink px-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
        />
      </label>

      {tecladoPropio && (
        <div className="mt-3">
          <Keyboard
            onKey={(char) => setLabel((actual) => (actual + char).slice(0, 40))}
            onBackspace={() => setLabel((actual) => actual.slice(0, -1))}
            onClear={() => setLabel("")}
          />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 border border-line text-base text-muted"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={pending || label.trim().length < 2}
          onClick={submit}
          className="flex h-12 flex-1 items-center justify-center gap-2 bg-crimson text-base text-bone disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Separar su cuenta
        </button>
      </div>
    </div>
  );
}
