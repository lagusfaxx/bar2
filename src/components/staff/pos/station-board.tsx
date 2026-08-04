"use client";

import { Check, RotateCcw, Utensils, Wine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { moveTicket } from "@/app/actions/pos";
import type { BoardTicket } from "@/lib/pos";

/**
 * Pantalla de cocina o de barra.
 *
 * Pensada para mirarse de lejos y con las manos ocupadas: tres columnas
 * —nuevas, en preparacion, listas—, letra grande y un solo boton por comanda.
 * Se refresca sola, asi que queda encendida toda la noche sin que nadie la
 * toque.
 */
export function StationBoard({
  station,
  tickets,
}: {
  station: "BARRA" | "COCINA";
  tickets: BoardTicket[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // La pantalla vive colgada en la pared: se actualiza sola cada 10 segundos.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);

  const move = (ticketId: string, prep: "NUEVA" | "EN_CURSO" | "LISTA") => {
    startTransition(async () => {
      await moveTicket(ticketId, prep);
      router.refresh();
    });
  };

  const nuevas = tickets.filter((ticket) => ticket.prep === "NUEVA");
  const enCurso = tickets.filter((ticket) => ticket.prep === "EN_CURSO");
  const listas = tickets.filter((ticket) => ticket.prep === "LISTA");

  const Icon = station === "BARRA" ? Wine : Utensils;

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink px-4 py-3 pt-safe">
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-3 font-display text-2xl text-bone">
            <Icon className="size-6 text-crimson-bright" aria-hidden />
            {station === "BARRA" ? "Barra" : "Cocina"}
          </h1>

          <p className="text-right text-[0.65rem] uppercase tracking-[0.16em] text-muted">
            {nuevas.length + enCurso.length} pendiente(s)
            <Clock />
          </p>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-line md:grid-cols-3">
        <Column
          title="Nuevas"
          count={nuevas.length}
          tone="crimson"
          empty="Sin comandas nuevas"
        >
          {nuevas.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              disabled={pending}
              action={{ label: "Empezar", onClick: () => move(ticket.id, "EN_CURSO") }}
            />
          ))}
        </Column>

        <Column
          title="En preparación"
          count={enCurso.length}
          tone="gilt"
          empty="Nada en preparación"
        >
          {enCurso.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              disabled={pending}
              action={{ label: "Listo", onClick: () => move(ticket.id, "LISTA") }}
              back={() => move(ticket.id, "NUEVA")}
            />
          ))}
        </Column>

        <Column
          title="Listas"
          count={listas.length}
          tone="emerald"
          empty="Nada listo todavía"
        >
          {listas.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              disabled={pending}
              done
              back={() => move(ticket.id, "EN_CURSO")}
            />
          ))}
        </Column>
      </main>
    </>
  );
}

/** Reloj de pared: confirma de un vistazo que la pantalla sigue viva. */
function Clock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );

    update();
    const timer = setInterval(update, 10_000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return null;

  return <span className="ml-3 font-display text-lg text-bone-dim">{time}</span>;
}

function Column({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string;
  count: number;
  tone: "crimson" | "gilt" | "emerald";
  empty: string;
  children: React.ReactNode;
}) {
  const tones = {
    crimson: "text-crimson-bright",
    gilt: "text-gilt-soft",
    emerald: "text-emerald-300",
  } as const;

  return (
    <section className="flex min-h-0 flex-col bg-ink">
      <h2 className="flex shrink-0 items-baseline gap-2 border-b border-line px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted">
        {title}
        <span className={`font-display text-lg ${tones[tone]}`}>{count}</span>
      </h2>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pb-safe">
        {count === 0 ? (
          <p className="py-10 text-center text-sm text-muted-dark">{empty}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function TicketCard({
  ticket,
  action,
  back,
  done,
  disabled,
}: {
  ticket: BoardTicket;
  action?: { label: string; onClick: () => void };
  back?: () => void;
  done?: boolean;
  disabled: boolean;
}) {
  return (
    <article
      className={[
        "border bg-ink-soft",
        done ? "border-emerald-500/40 opacity-70" : "border-line",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2">
        <p className="font-display text-2xl text-bone">
          Mesa {ticket.tableNumber}
        </p>
        <p className="text-right text-[0.65rem] uppercase tracking-[0.14em] text-muted">
          #{ticket.number}
          <Waiting since={ticket.createdAt} />
        </p>
      </div>

      <ul className="space-y-2 px-3 py-3">
        {ticket.items.map((item) => (
          <li key={item.id}>
            <p className="font-display text-xl leading-tight text-bone">
              <span className="text-crimson-bright">{item.quantity}×</span>{" "}
              {item.name}
            </p>

            {/* La nota va destacada: es lo que se pasa por alto y vuelve el plato. */}
            {item.note && (
              <p className="mt-1 border-l-2 border-gilt bg-gilt/10 px-2 py-1 text-sm font-medium text-gilt-soft">
                {item.note}
              </p>
            )}

            {item.diner && (
              <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                {item.diner}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-px border-t border-line">
        {back && (
          <button
            type="button"
            onClick={back}
            disabled={disabled}
            aria-label="Volver al paso anterior"
            className="flex h-14 w-16 shrink-0 items-center justify-center border-r border-line text-muted disabled:opacity-40"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
        )}

        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            disabled={disabled}
            className="h-14 flex-1 bg-crimson text-sm font-medium uppercase tracking-[0.16em] text-bone disabled:opacity-50"
          >
            {action.label}
          </button>
        ) : (
          <p className="flex h-14 flex-1 items-center justify-center gap-2 text-sm uppercase tracking-[0.16em] text-emerald-300">
            <Check className="size-4" aria-hidden />
            Lista
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Cuanto lleva esperando la comanda.
 *
 * Pasa a rojo a los diez minutos: es la señal que hace que alguien reaccione
 * sin tener que ir a preguntar.
 */
function Waiting({ since }: { since: string }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setMinutes(Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60000)));

    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [since]);

  if (minutes === null) return null;

  return (
    <span
      className={[
        "ml-2 font-display text-base",
        minutes >= 10 ? "text-crimson-bright" : "text-bone-dim",
      ].join(" ")}
    >
      {minutes} min
    </span>
  );
}
