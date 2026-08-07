"use client";

import { Utensils, Wine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useWakeLock } from "@/components/staff/use-wake-lock";
import type { BoardTicket } from "@/lib/pos";

/**
 * Pantalla de cocina o de barra.
 *
 * No tiene un solo boton, y es a proposito: quien cocina tiene las manos
 * mojadas o con grasa y no las va a secar para tocar una pantalla. Antes esto
 * pedia dos toques por comanda —"empezar" y "listo"— y en la practica no los
 * daba nadie, asi que el tablero mostraba un estado que no era cierto.
 *
 * Ahora es lo que se necesita de verdad: la lista de lo que falta preparar,
 * la mas vieja arriba, con el tiempo que lleva esperando en letra grande. La
 * comanda desaparece cuando el garzon marca que se la llevo, desde su
 * telefono. Que el plato esta listo lo sigue avisando la campana, como
 * siempre.
 */

/**
 * Cuando una espera deja de ser normal.
 *
 * A los ocho minutos la comanda pasa a ambar y a los quince a rojo, con la
 * tarjeta entera marcada: la idea es que desde el otro lado de la cocina se
 * vea cual es la que esta atrasada sin leer un solo numero.
 */
const AMBAR_MINUTOS = 8;
const ROJO_MINUTOS = 15;

export function StationBoard({
  station,
  tickets,
}: {
  station: "BARRA" | "COCINA";
  tickets: BoardTicket[];
}) {
  const router = useRouter();

  // La pantalla vive colgada en la pared: se actualiza sola cada 10 segundos.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);

  // Y no se apaga: un tablero que hay que despertar tocandolo no sirve de nada
  // aca, que es justo lo que no se puede hacer.
  useWakeLock();

  const Icon = station === "BARRA" ? Wine : Utensils;

  /* Cuanto ocupa cada comanda, segun cuantas haya que mostrar a la vez. */
  const columnas =
    tickets.length <= 2
      ? "grid-cols-1 lg:grid-cols-2"
      : tickets.length <= 6
        ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

  const escala: Escala =
    tickets.length <= 2 ? "grande" : tickets.length <= 6 ? "media" : "chica";

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink px-4 py-3 pt-safe">
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-3 font-display text-2xl text-bone">
            <Icon className="size-6 text-crimson-bright" aria-hidden />
            {station === "BARRA" ? "Barra" : "Cocina"}
          </h1>

          <p className="flex items-baseline gap-3">
            <span className="font-display text-3xl text-bone">
              {tickets.length}
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              por preparar
            </span>
            <Clock />
          </p>
        </div>

        {/* Lo pendiente, sumado por producto.
            En una barra llena es lo que evita hacer los mismos cuatro pisco
            sours de a uno: se ven juntos aunque esten en comandas distintas. */}
        {tickets.length > 1 && <Totals tickets={tickets} />}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-ink p-3 pb-safe">
        {tickets.length === 0 ? (
          <p className="py-20 text-center font-display text-3xl text-muted-dark">
            No hay nada pendiente
          </p>
        ) : (
          /*
           * La cuadricula se aprieta segun cuanto haya.
           *
           * Con dos comandas en una pantalla de pared, tres columnas fijas
           * dejaban dos tarjetas chiquitas arriba a la izquierda y el resto
           * negro: hay que acercarse a leer justo cuando sobra espacio. La
           * pantalla usa todo lo que tiene y solo se achica cuando hay mucho.
           */
          <div className={`grid gap-3 ${columnas}`}>
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} escala={escala} />
            ))}
          </div>
        )}
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

  return <span className="font-display text-lg text-bone-dim">{time}</span>;
}

/** Todo lo pendiente de la estacion sumado por producto. */
function Totals({ tickets }: { tickets: BoardTicket[] }) {
  const totals = new Map<string, number>();

  for (const ticket of tickets) {
    for (const item of ticket.items) {
      totals.set(item.name, (totals.get(item.name) ?? 0) + item.quantity);
    }
  }

  const ordenados = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {ordenados.map(([name, quantity]) => (
        <span key={name}>
          <span className="font-display text-base text-bone-dim">
            {quantity}×
          </span>{" "}
          {name}
        </span>
      ))}
    </p>
  );
}

type Escala = "grande" | "media" | "chica";

/** Tamaños de letra por escala: mesa y reloj arriba, productos abajo. */
const TIPOGRAFIA: Record<
  Escala,
  { cabecera: string; producto: string; nota: string }
> = {
  grande: { cabecera: "text-5xl", producto: "text-4xl", nota: "text-2xl" },
  media: { cabecera: "text-4xl", producto: "text-3xl", nota: "text-xl" },
  chica: { cabecera: "text-3xl", producto: "text-2xl", nota: "text-base" },
};

function TicketCard({
  ticket,
  escala,
}: {
  ticket: BoardTicket;
  escala: Escala;
}) {
  const tipografia = TIPOGRAFIA[escala];
  const minutes = useMinutesSince(ticket.createdAt);

  const nivel =
    minutes === null
      ? "normal"
      : minutes >= ROJO_MINUTOS
        ? "rojo"
        : minutes >= AMBAR_MINUTOS
          ? "ambar"
          : "normal";

  const marco = {
    normal: "border-line bg-ink-soft",
    ambar: "border-gilt/60 bg-gilt/10",
    rojo: "border-crimson bg-crimson/15",
  }[nivel];

  return (
    <article className={`flex flex-col border ${marco}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line/60 px-3 py-2">
        <p className={`font-display text-bone ${tipografia.cabecera}`}>
          Mesa {ticket.tableNumber}
          <span className="ml-2 text-sm text-muted">#{ticket.number}</span>
        </p>

        {/* El tiempo es el dato que manda en esta pantalla: va tan grande como
            el numero de mesa y cambia de color solo. */}
        <p
          className={[
            `font-display tabular-nums ${tipografia.cabecera}`,
            nivel === "rojo"
              ? "text-crimson-bright"
              : nivel === "ambar"
                ? "text-gilt-soft"
                : "text-bone-dim",
          ].join(" ")}
        >
          {minutes === null ? "" : `${minutes}′`}
        </p>
      </div>

      <ul className="space-y-2 px-3 py-3">
        {ticket.items.map((item) => (
          <li key={item.id}>
            <p
              className={`font-display leading-tight text-bone ${tipografia.producto}`}
            >
              <span className="text-crimson-bright">{item.quantity}×</span>{" "}
              {item.name}
            </p>

            {/* La nota va destacada: es lo que se pasa por alto y vuelve el plato. */}
            {item.note && (
              <p
                className={`mt-1 border-l-2 border-gilt bg-gilt/10 px-2 py-1 font-medium text-gilt-soft ${tipografia.nota}`}
              >
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
    </article>
  );
}

/**
 * Minutos desde que se mando la comanda.
 *
 * Se calcula despues de montar y se refresca cada treinta segundos: leer el
 * reloj durante el render daria un valor distinto en el servidor y en el
 * cliente.
 */
function useMinutesSince(since: string) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setMinutes(Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60000)));

    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [since]);

  return minutes;
}
