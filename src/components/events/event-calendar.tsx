"use client";

import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EventCard } from "@/components/events/event-card";
import { Badge } from "@/components/ui/section";
import type { EventCard as EventCardData } from "@/lib/content";
import { dateParts, dayKey, EVENT_CATEGORY_LABELS, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Los eventos llegan serializados desde el servidor. */
export type CalendarEvent = Omit<EventCardData, "startsAt" | "doorsAt"> & {
  startsAt: string;
  doorsAt: string | null;
};

const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type View = "calendar" | "list";

/** Un dia en que el local no abre, ya reducido a "YYYY-MM-DD" del local. */
export type ClosedDay = { date: string; reason: string };

export function EventCalendar({
  events,
  closedDays = [],
}: {
  events: CalendarEvent[];
  closedDays?: ClosedDay[];
}) {
  const today = new Date();
  const todayKey = dayKey(today);

  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>("calendar");

  // Indice dia -> eventos, para pintar la grilla sin recorrer todo en cada celda.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const key = dayKey(event.startsAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }

    return map;
  }, [events]);

  // Celdas del mes, alineadas a una semana que empieza en lunes.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(cursor.year, cursor.month, 1);
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

    // getDay() devuelve 0 para domingo; lo convertimos a semana lunes-domingo.
    const leading = (firstOfMonth.getDay() + 6) % 7;

    const result: Array<{ date: Date; key: string } | null> = Array.from(
      { length: leading },
      () => null,
    );

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(cursor.year, cursor.month, day, 12);
      result.push({ date, key: dayKey(date) });
    }

    // Completa la ultima semana para que la grilla no quede dentada.
    while (result.length % 7 !== 0) result.push(null);

    return result;
  }, [cursor]);

  /*
   * Dias cerrados, indexados igual que los eventos.
   *
   * Un cierre no esconde la cartelera de ese dia: el show existe y su afiche
   * se sigue mostrando, marcado como privado. Esconderlo dejaba a quien
   * pensaba venir sin enterarse de nada, y al local sin el anuncio de que se
   * puede arrendar — que es la mitad de la razon de tener esto.
   */
  const cerrados = useMemo(
    () => new Map(closedDays.map((day) => [day.date, day.reason])),
    [closedDays],
  );

  const monthEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const date = new Date(event.startsAt);
          return (
            date.getFullYear() === cursor.year && date.getMonth() === cursor.month
          );
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, cursor],
  );

  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];
  const selectedClosed = selected ? cerrados.get(selected) : undefined;

  const shift = (delta: number) => {
    setSelected(null);
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(todayKey);
  };

  return (
    <div>
      {/* Controles */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Mes anterior"
              className="flex size-10 items-center justify-center border border-line text-bone-dim transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="Mes siguiente"
              className="flex size-10 items-center justify-center border border-line text-bone-dim transition-colors hover:border-crimson hover:text-crimson-bright"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <p aria-live="polite" className="font-display text-2xl text-bone sm:text-3xl">
            {MONTHS[cursor.month]}{" "}
            <span className="text-muted-dark">{cursor.year}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="border border-line px-4 py-2.5 text-[0.65rem] font-medium tracking-[0.18em] text-bone-dim uppercase transition-colors hover:border-crimson hover:text-bone"
          >
            Hoy
          </button>

          {/* En movil la lista suele ser mas comoda que la grilla. */}
          <div
            role="group"
            aria-label="Cambiar vista"
            className="flex border border-line"
          >
            <button
              type="button"
              onClick={() => setView("calendar")}
              aria-pressed={view === "calendar"}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-[0.65rem] font-medium tracking-[0.18em] uppercase transition-colors",
                view === "calendar"
                  ? "bg-crimson text-bone"
                  : "text-muted hover:text-bone",
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Calendario</span>
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-[0.65rem] font-medium tracking-[0.18em] uppercase transition-colors",
                view === "list"
                  ? "bg-crimson text-bone"
                  : "text-muted hover:text-bone",
              )}
            >
              <LayoutList className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div
              role="grid"
              aria-label={`Calendario de ${MONTHS[cursor.month]} ${cursor.year}`}
              className="card-bz p-2 sm:p-4"
            >
              <div role="row" className="grid grid-cols-7">
                {WEEKDAY_INITIALS.map((initial, index) => (
                  <div
                    key={index}
                    role="columnheader"
                    className="pb-3 text-center text-[0.6rem] font-semibold tracking-[0.2em] text-muted-dark uppercase"
                  >
                    {initial}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {cells.map((cell, index) => {
                  if (!cell) {
                    return <div key={`empty-${index}`} role="gridcell" />;
                  }

                  const closedReason = cerrados.get(cell.key);
                  const isClosed = closedReason !== undefined;
                  const dayEvents = byDay.get(cell.key) ?? [];
                  const hasEvents = dayEvents.length > 0;
                  const isToday = cell.key === todayKey;
                  const isSelected = cell.key === selected;

                  return (
                    <button
                      key={cell.key}
                      role="gridcell"
                      type="button"
                      disabled={!hasEvents && !isClosed}
                      onClick={() => setSelected(isSelected ? null : cell.key)}
                      aria-label={`${cell.date.getDate()} de ${MONTHS[cursor.month]}${
                        hasEvents
                          ? `, ${dayEvents.length} evento${dayEvents.length > 1 ? "s" : ""}`
                          : ""
                      }${isClosed ? `, ${closedReason}` : hasEvents ? "" : ", sin eventos"}`}
                      aria-selected={isSelected}
                      className={cn(
                        // 44px minimo: objetivo tactil comodo en movil.
                        // Solo color y sombra: con `transition-all`, cualquier
                        // propiedad que cambie al seleccionar el dia se anima,
                        // incluidas las que afectan al tamano de la celda.
                        "relative flex aspect-square min-h-11 flex-col items-center justify-center gap-1 border text-sm transition-[background-color,border-color,color,box-shadow] duration-300",
                        // Con show, el dia se ve como cualquier otro con
                        // show: el candado dice que ademas es privado. Sin
                        // show, el cierre se marca apagado.
                        hasEvents
                          ? "cursor-pointer border-crimson/35 bg-crimson/8 text-bone hover:border-crimson hover:bg-crimson/20"
                          : isClosed
                            ? "cursor-pointer border-gilt/35 bg-gilt/8 text-bone-dim hover:border-gilt/60"
                            : "border-transparent text-muted-dark",
                        isSelected &&
                          hasEvents &&
                          "border-crimson bg-crimson text-bone shadow-[0_0_28px_-6px_rgba(225,29,42,0.8)]",
                        isSelected && isClosed && !hasEvents && "border-gilt/70 bg-gilt/25 text-bone",
                        isToday && !isSelected && "ring-1 ring-bone/35",
                      )}
                    >
                      <span
                        className={cn(
                          "font-display text-base leading-none tabular-nums sm:text-lg",
                          isToday && !isSelected && "text-crimson-bright",
                        )}
                      >
                        {cell.date.getDate()}
                      </span>

                      {isClosed && (
                        <Lock className="size-3 text-gilt-soft" aria-hidden />
                      )}

                      {hasEvents && (
                        <span className="flex gap-0.5" aria-hidden>
                          {dayEvents.slice(0, 3).map((event) => (
                            <span
                              key={event.id}
                              className={cn(
                                "size-1 rounded-full",
                                isSelected ? "bg-bone" : "bg-crimson-bright",
                              )}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-dark">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 border border-crimson/50 bg-crimson/15" />
                Con eventos
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 ring-1 ring-bone/40" />
                Hoy
              </span>
              {closedDays.length > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Lock className="size-3 text-gilt-soft" aria-hidden />
                  Evento privado
                </span>
              )}
            </p>
          </div>

          {/* Panel lateral: detalle del dia elegido o agenda del mes. */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            {selectedClosed ? (
              <>
                <div className="card-bz mb-4 border-gilt/40 bg-gilt/8 p-5">
                  <h3 className="flex items-center gap-2 font-display text-lg text-gilt-soft capitalize">
                    <Lock className="size-4 shrink-0" aria-hidden />
                    {selectedClosed}
                  </h3>
                  <p className="mt-2 text-sm text-bone-dim">
                    Esa noche el local está reservado: se entra solo con
                    invitación.
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    ¿Quieres celebrar lo tuyo aquí?{" "}
                    <Link
                      href="/contacto"
                      className="text-crimson-bright underline underline-offset-4"
                    >
                      Escríbenos
                    </Link>
                    .
                  </p>
                </div>

                {selectedEvents.length > 0 && (
                  <ul className="flex flex-col gap-3">
                    {selectedEvents.map((event) => (
                      <li key={event.id}>
                        <DayEventRow event={event} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : selected && selectedEvents.length > 0 ? (
              <>
                <h3 className="mb-4 font-display text-xl text-bone capitalize">
                  {dateParts(selectedEvents[0]!.startsAt).weekday}{" "}
                  {dateParts(selectedEvents[0]!.startsAt).day} de{" "}
                  {dateParts(selectedEvents[0]!.startsAt).monthLong}
                </h3>
                <ul className="flex flex-col gap-3">
                  {selectedEvents.map((event) => (
                    <li key={event.id}>
                      <DayEventRow event={event} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h3 className="mb-4 font-display text-xl text-bone">
                  Agenda de {MONTHS[cursor.month]}
                </h3>
                {monthEvents.length > 0 ? (
                  <ul className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
                    {monthEvents.map((event) => (
                      <li key={event.id}>
                        <DayEventRow event={event} showDate />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="card-bz p-6 text-sm text-muted">
                    No hay eventos programados para este mes. Prueba con el mes
                    siguiente.
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
      ) : (
        <div>
          {monthEvents.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {monthEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={{
                    ...event,
                    startsAt: new Date(event.startsAt),
                    doorsAt: event.doorsAt ? new Date(event.doorsAt) : null,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="card-bz p-10 text-center text-sm text-muted">
              No hay eventos programados para {MONTHS[cursor.month]}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DayEventRow({
  event,
  showDate = false,
}: {
  event: CalendarEvent;
  showDate?: boolean;
}) {
  const parts = dateParts(event.startsAt);

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="card-bz hover-ember group flex items-center gap-4 p-3"
    >
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-line pr-3 text-center">
        {showDate ? (
          <>
            <span className="font-display text-lg leading-none text-bone">
              {parts.day}
            </span>
            <span className="mt-1 text-[0.55rem] tracking-[0.15em] text-crimson-bright">
              {parts.month}
            </span>
          </>
        ) : (
          <span className="font-display text-base text-bone tabular-nums">
            {parts.time}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base text-bone transition-colors group-hover:text-crimson-bright">
          {event.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {event.artist ?? EVENT_CATEGORY_LABELS[event.category]}
        </p>
      </div>

      {/* Con el local arrendado no hay entrada que valga: decir "Libre" al
          lado del aviso de evento privado se contradice. */}
      <Badge
        tone={event.privateReason ? "gilt" : event.isFree ? "free" : "muted"}
        className="shrink-0"
      >
        {event.privateReason
          ? "Solo invitados"
          : event.isFree
            ? "Libre"
            : formatPrice(event.priceCents)}
      </Badge>
    </Link>
  );
}
