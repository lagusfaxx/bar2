"use client";

import {
  ArrowLeft,
  Ban,
  Loader2,
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
import { PaySheet } from "@/components/staff/pos/pay-sheet";
import { ProductPicker } from "@/components/staff/pos/product-picker";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { PosMenuCategory, SessionDetail } from "@/lib/pos";

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
}: {
  session: SessionDetail;
  menu: PosMenuCategory[];
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [paying, setPaying] = useState<"tab" | "table" | null>(null);
  const [addingDiner, setAddingDiner] = useState(false);
  const [feedback, setFeedback] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  const tab =
    session.tabs.find((candidate) => candidate.dinerId === activeTab) ??
    session.tabs[0];

  const run = (action: () => Promise<FormState>) => {
    startTransition(async () => setFeedback(await action()));
  };

  const cerrada = session.status === "CLOSED";

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink pt-safe">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
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
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              {session.code} · {session.guests} pers.
              {cerrada && <span className="ml-2 text-bone-dim">Cerrada</span>}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted">
              Pendiente
            </p>
            <p className="font-display text-xl text-bone">
              {formatPrice(session.pendingCents)}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4">
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

        {/* Pestanas: la mesa y cada comensal */}
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
              Comensal
            </button>
          )}
        </div>

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
                onClick={() => run(() => removeDiner(tab.dinerId!))}
                className="text-[0.65rem] uppercase tracking-[0.16em] text-muted hover:text-crimson-bright"
              >
                Quitar comensal
              </button>
            )}
          </div>

          {tab.items.length === 0 ? (
            <p className="mt-3 border border-line bg-ink-soft p-5 text-sm text-muted">
              Sin consumo todavía.
            </p>
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

                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.65rem] uppercase tracking-[0.14em]">
                        <span className="text-muted">
                          {item.station === "BARRA" ? "Barra" : "Cocina"}
                        </span>

                        {item.status === "DRAFT" && (
                          <span className="text-gilt-soft">Sin mandar</span>
                        )}

                        {item.paid && (
                          <span className="text-emerald-300">Pagado</span>
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
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => cancelItem(item.id))}
                          className="flex items-center gap-1.5 border border-line px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.16em] text-muted hover:border-crimson hover:text-crimson-bright"
                        >
                          <Ban className="size-3.5" aria-hidden />
                          Anular
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Comandas: solo interesa cuando algo no salio */}
        {session.tickets.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
              Comandas
            </h2>

            <ul className="mt-2 flex flex-col gap-1.5">
              {session.tickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-center justify-between gap-3 border border-line bg-ink-soft px-3 py-2 text-sm"
                >
                  <span className="text-bone-dim">
                    #{ticket.number} · {ticket.station === "BARRA" ? "Barra" : "Cocina"}
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
                        ? "Impresa"
                        : ticket.status === "FAILED"
                          ? "Falló"
                          : "En cola"}
                    </span>

                    {ticket.status !== "PENDING" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => reprintTicket(ticket.id))}
                        aria-label={`Reimprimir comanda ${ticket.number}`}
                        className="flex size-8 items-center justify-center border border-line text-muted hover:border-crimson hover:text-crimson-bright"
                      >
                        <RotateCw className="size-3.5" aria-hidden />
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
            onClick={() => run(() => closeTable(session.id))}
            className="mt-8 h-12 w-full border border-line text-sm uppercase tracking-[0.16em] text-muted hover:border-crimson hover:text-crimson-bright"
          >
            Cerrar mesa y liberarla
          </button>
        )}
      </main>

      {/* Barra de acciones: siempre bajo el pulgar, nunca flotando */}
      {!cerrada && (
        <div className="shrink-0 border-t border-line bg-ink pb-safe">
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="flex h-14 flex-1 items-center justify-center gap-2 border border-bone/25 text-sm uppercase tracking-[0.16em] text-bone"
            >
              <Plus className="size-4" aria-hidden />
              Agregar
            </button>

            {session.draftCount > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => sendOrder(session.id))}
                className="flex h-14 flex-[1.4] items-center justify-center gap-2 bg-gilt text-sm font-medium uppercase tracking-[0.16em] text-ink disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                Mandar ({session.draftCount})
              </button>
            ) : (
              <button
                type="button"
                disabled={session.pendingCents === 0}
                onClick={() => setPaying(tab.pendingCents > 0 ? "tab" : "table")}
                className="flex h-14 flex-[1.4] items-center justify-center gap-2 bg-crimson text-sm font-medium uppercase tracking-[0.16em] text-bone disabled:opacity-40"
              >
                <Wallet className="size-4" aria-hidden />
                Cobrar
              </button>
            )}
          </div>

          {/* Con la mesa repartida, hay que poder elegir a quien se le cobra */}
          {session.draftCount === 0 &&
            session.pendingCents > 0 &&
            session.diners.length > 0 && (
              <div className="mx-auto flex max-w-2xl gap-2 px-4 pb-3">
                <button
                  type="button"
                  disabled={tab.pendingCents === 0}
                  onClick={() => setPaying("tab")}
                  className="h-11 flex-1 border border-line text-[0.65rem] uppercase tracking-[0.16em] text-bone-dim disabled:opacity-40"
                >
                  Solo {tab.label} · {formatPrice(tab.pendingCents)}
                </button>

                <button
                  type="button"
                  onClick={() => setPaying("table")}
                  className="h-11 flex-1 border border-line text-[0.65rem] uppercase tracking-[0.16em] text-bone-dim"
                >
                  Toda la mesa · {formatPrice(session.pendingCents)}
                </button>
              </div>
            )}
        </div>
      )}

      {picker && (
        <ProductPicker
          sessionId={session.id}
          dinerId={tab.dinerId}
          dinerLabel={tab.label}
          menu={menu}
          onClose={() => setPicker(false)}
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
    </>
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
        <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted">
          ¿Cómo se ve?
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
          className="h-11 flex-1 border border-line text-sm uppercase tracking-[0.16em] text-muted"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={pending || label.trim().length < 2}
          onClick={submit}
          className="flex h-11 flex-1 items-center justify-center gap-2 bg-crimson text-sm uppercase tracking-[0.16em] text-bone disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Agregar
        </button>
      </div>
    </div>
  );
}
