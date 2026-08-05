"use client";

import {
  ArrowLeft,
  Ban,
  Loader2,
  MessageSquarePlus,
  Minus,
  Plus,
  RotateCw,
  Send,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  addDiner,
  cancelItem,
  closeTable,
  removeDiner,
  reprintTicket,
  sendOrder,
  setItemQuantity,
} from "@/app/actions/pos";
import { ConfirmSheet } from "@/components/staff/pos/confirm-sheet";
import { NoteSheet } from "@/components/staff/pos/note-sheet";
import { PaySheet } from "@/components/staff/pos/pay-sheet";
import { ProductPicker } from "@/components/staff/pos/product-picker";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type {
  AccountItem,
  AccountTab,
  PosMenuCategory,
  PosMenuProduct,
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
  autoOpenPicker = false,
}: {
  session: SessionDetail;
  menu: PosMenuCategory[];
  frequent: PosMenuProduct[];
  /** Mesa recien abierta: se entra directo a cargar, sin un toque de mas. */
  autoOpenPicker?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [picker, setPicker] = useState(autoOpenPicker);
  const [noting, setNoting] = useState<AccountItem | null>(null);
  const [paying, setPaying] = useState<"tab" | "table" | null>(null);
  const [addingDiner, setAddingDiner] = useState(false);
  const [feedback, setFeedback] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  /* Confirmaciones de lo que no se puede deshacer. */
  const [cancelling, setCancelling] = useState<AccountItem | null>(null);
  const [removingDiner, setRemovingDiner] = useState<AccountTab | null>(null);
  const [closing, setClosing] = useState(false);
  const [choosingPayer, setChoosingPayer] = useState(false);

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

  /** La mesa esta repartida entre varias personas. */
  const cuentaSeparada = session.diners.length > 0;

  /**
   * Abre el cobro.
   *
   * Con la mesa entera para una sola persona no hay nada que preguntar. Con la
   * cuenta separada si: antes el boton elegia solo —cobraba la pestaña abierta
   * si tenia saldo y si no la mesa entera— y esa decision, que define quien
   * paga cuanto, quedaba escondida en una condicion.
   */
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
            <h1 className="font-display text-xl text-bone">
              Mesa {session.table.number}
              {session.table.name && (
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
                        <div className="mt-2 flex items-center gap-2">
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
                            {item.note ? "Cambiar nota" : "Agregar nota"}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/*
              Los papeles que se imprimieron en cocina y barra.

              Se llamaba "Comandas" y los estados eran "Impresa", "En cola" y
              "Falló", que describen una impresora y no lo que el garzon tiene que
              decidir: si el pedido llego o si hay que volver a mandarlo.
            */}
            {session.tickets.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-medium text-bone-dim">
                  Papeles impresos
                </h2>

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

                      <span className="flex items-center gap-3">
                        <span
                          className={
                            ticket.status === "PRINTED"
                              ? "text-emerald-300"
                              : ticket.status === "FAILED"
                                ? "text-crimson-bright"
                                : "text-gilt-soft"
                          }
                        >
                          {ticket.status === "PRINTED"
                            ? "Llegó"
                            : ticket.status === "FAILED"
                              ? "No llegó"
                              : "Enviando…"}
                        </span>

                        {ticket.status !== "PENDING" && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => reprintTicket(ticket.id))}
                            className="flex h-9 items-center gap-1.5 border border-line px-3 text-sm text-muted hover:border-crimson hover:text-crimson-bright"
                          >
                            <RotateCw className="size-3.5" aria-hidden />
                            Reimprimir
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {session.tickets.some((ticket) => ticket.lastError) && (
                  <p className="mt-2 text-xs text-crimson-bright">
                    {session.tickets.find((ticket) => ticket.lastError)?.lastError}
                  </p>
                )}
              </section>
            )}

            {/* Cierre: solo cuando ya no queda nada por cobrar */}
            {!cerrada && session.pendingCents === 0 && session.paidCents > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setClosing(true)}
                className="mt-8 h-12 w-full border border-line text-base text-muted hover:border-crimson hover:text-crimson-bright"
              >
                Cerrar la mesa y dejarla libre
              </button>
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
                    onClick={() => run(() => sendOrder(session.id))}
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
                  <button
                    type="button"
                    disabled={session.pendingCents === 0}
                    onClick={startPayment}
                    className="flex h-14 flex-[1.6] items-center justify-center gap-2 bg-crimson text-base font-medium text-bone disabled:opacity-40"
                  >
                    <Wallet className="size-5" aria-hidden />
                    {session.pendingCents === 0
                      ? "Todo pagado"
                      : `Cobrar ${formatPrice(session.pendingCents)}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* La carta, fija, solo cuando hay ancho de sobra. */}
        {!cerrada && (
          <aside className="hidden w-[26rem] shrink-0 border-l border-line lg:block xl:w-[30rem]">
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

      {/* En el telefono, la misma carta a pantalla completa. */}
      {picker && (
        <div className="lg:hidden">
          <ProductPicker
            sessionId={session.id}
            dinerId={tab.dinerId}
            dinerLabel={tab.label}
            menu={menu}
            frequent={frequent}
            onClose={() => setPicker(false)}
          />
        </div>
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
          onClose={() => setPaying(null)}
        />
      )}

      {/* Con la cuenta separada, a quien se le cobra es una pregunta, no una
          deduccion del sistema. */}
      {choosingPayer && (
        <PayerSheet
          tabLabel={tab.label}
          tabPendingCents={tab.pendingCents}
          tablePendingCents={session.pendingCents}
          onPick={(who) => {
            setChoosingPayer(false);
            setPaying(who);
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
          title={`¿Cerrar la mesa ${session.table.number}?`}
          detail="Queda libre para los próximos clientes y ya no se le puede agregar nada. Está todo pagado."
          confirmLabel="Sí, cerrar la mesa"
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
 * Solo aparece con la cuenta separada. Las dos opciones se muestran con su
 * monto, porque es lo que se compara al decidir — y porque es lo que hay que
 * cantar en voz alta antes de pasar la maquina.
 */
function PayerSheet({
  tabLabel,
  tabPendingCents,
  tablePendingCents,
  onPick,
  onClose,
}: {
  tabLabel: string;
  tabPendingCents: number;
  tablePendingCents: number;
  onPick: (who: "tab" | "table") => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="¿Quién paga?"
      className="fixed inset-0 z-60 flex h-[100dvh] items-end bg-ink/80"
    >
      <div className="w-full border-t border-line bg-ink-soft p-5 pb-safe">
        <h2 className="font-display text-xl text-bone">¿Quién paga ahora?</h2>
        <p className="mt-2 text-sm text-muted">
          Cobrar a una persona no cierra la mesa: los demás siguen consumiendo.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={tabPendingCents === 0}
            onClick={() => onPick("tab")}
            className="flex h-16 w-full items-center justify-between border border-line px-4 text-left disabled:opacity-40"
          >
            <span className="text-base text-bone">Solo {tabLabel}</span>
            <span className="font-display text-lg text-bone">
              {formatPrice(tabPendingCents)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onPick("table")}
            className="flex h-16 w-full items-center justify-between border border-line px-4 text-left"
          >
            <span className="text-base text-bone">Toda la mesa</span>
            <span className="font-display text-lg text-bone">
              {formatPrice(tablePendingCents)}
            </span>
          </button>

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
        <input
          type="text"
          value={label}
          autoFocus
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Polera azul, pelo largo…"
          className="mt-2 h-12 w-full border border-line bg-ink px-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
        />
      </label>

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
