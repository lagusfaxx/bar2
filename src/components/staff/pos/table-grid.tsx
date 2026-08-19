"use client";

import { Loader2, Plus, Printer, Send, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { openTable, sendOrder } from "@/app/actions/pos";
import { Elapsed } from "@/components/staff/pos/elapsed";
import { useLiveRefresh } from "@/components/staff/use-live-refresh";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import type { TableOverview } from "@/lib/pos";
import { tagColor, zoneColor } from "@/lib/pos-style";

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
export function TableGrid({ tables }: { tables: TableOverview[] }) {
  const router = useRouter();
  const [opening, setOpening] = useState<TableOverview | null>(null);

  /**
   * Que zona se esta mirando. `null` es la sala entera.
   *
   * En un local con terraza, el garzon que la atiende no tiene por que buscar
   * sus seis mesas entre las treinta del salon.
   */
  const [zona, setZona] = useState<string | null>(null);

  /*
   * La sala se pone al dia sola.
   *
   * Es la unica forma de que funcione el garzon que carga el pedido en su
   * telefono, camina hasta la caja y espera imprimir ahi: si esta pantalla se
   * quedara con lo que habia cuando alguien la toco por ultima vez, llegaria y
   * no veria nada de lo que acaba de cargar.
   */
  useLiveRefresh(10_000);

  if (tables.length === 0) {
    return (
      <p className="border border-line bg-ink-soft p-6 text-sm text-muted">
        No hay mesas cargadas. Créalas en el panel, en <strong>Sala → Mesas</strong>.
      </p>
    );
  }

  /*
   * La sala, partida en zonas.
   *
   * El orden lo pone el panel (posicion de la zona) y aca solo se respeta el
   * que traen las mesas. Las que no tienen zona van juntas al final, bajo
   * "Otras mesas": una mesa sin zona tiene que seguir viendose: es una mesa
   * del local igual que las demas.
   */
  const secciones: Array<{
    id: string | null;
    name: string | null;
    color: string | null;
    tables: TableOverview[];
  }> = [];

  for (const table of tables) {
    const id = table.zone?.id ?? null;
    const seccion = secciones.find((candidate) => candidate.id === id);

    if (seccion) {
      seccion.tables.push(table);
    } else {
      secciones.push({
        id,
        name: table.zone?.name ?? null,
        color: table.zone?.color ?? null,
        tables: [table],
      });
    }
  }

  // Las mesas sueltas al final, detras de las zonas.
  secciones.sort((a, b) => (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0));

  const visibles =
    zona === null
      ? secciones
      : secciones.filter((seccion) => seccion.id === zona);

  /** Con una sola zona (o ninguna) no hay nada que elegir ni que titular. */
  const porZonas = secciones.length > 1;

  return (
    <>
      <PorImprimir tables={tables} />

      {porZonas && (
        <div
          role="tablist"
          aria-label="Zonas del salón"
          className="mb-5 flex flex-wrap gap-2"
        >
          <ZoneTab
            active={zona === null}
            onClick={() => setZona(null)}
            label="Toda la sala"
            count={tables.length}
          />

          {secciones.map((seccion) => (
            <ZoneTab
              key={seccion.id ?? "sueltas"}
              active={zona === seccion.id}
              onClick={() => setZona(seccion.id)}
              label={seccion.name ?? "Otras mesas"}
              count={seccion.tables.length}
              color={seccion.color}
            />
          ))}
        </div>
      )}

      {visibles.map((seccion) => (
        <section key={seccion.id ?? "sueltas"} className="mb-6 last:mb-0">
          {porZonas && (
            <h2 className="mb-2 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              <span
                className={`size-2 rounded-full ${zoneColor(seccion.color).dot}`}
                aria-hidden
              />
              {seccion.name ?? "Otras mesas"}
            </h2>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {seccion.tables.map((table) => {
              const ocupada = table.session !== null;
              const etiqueta = table.session?.tag ?? null;

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

                  {/*
                    La etiqueta, apenas debajo del numero.

                    Es lo que cambia como se atiende esa mesa —un cumpleaños,
                    una reserva, gente apurada— y hasta ahora vivia solo en la
                    cabeza del que abrio la mesa. Va antes que el estado porque
                    se lee de reojo desde el otro lado del salon.
                  */}
                  {etiqueta && (
                    <span
                      className={`mt-2 inline-block max-w-full truncate border px-1.5 py-0.5 text-[0.7rem] ${
                        tagColor(table.session!.tagColor).chip
                      }`}
                    >
                      {etiqueta}
                    </span>
                  )}

                  {ocupada ? (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-crimson-bright">
                        Ocupada
                      </p>

                      {/*
                        Un solo aviso por mesa, el que manda.

                        La tarjeta llegó a mostrar cuatro renglones —cuántos
                        faltan enviar, cuánto se debe, cuántas comandas
                        esperan, cuántos se sentaron y hace cuánto—, y una sala
                        llena de eso es una pared de texto que no se lee de un
                        vistazo, que es exactamente para lo que sirve la vista
                        de sala. Con la mesa abierta lo urgente es siempre uno
                        solo: si hay algo sin mandar, mandarlo; si no, ir a
                        buscar lo que ya está listo. El resto —cuántos son,
                        hace cuánto— está dentro de la cuenta, a un toque, y
                        ahí sí importa.
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

                      {/*
                        Quien la atiende.

                        Es la pregunta que mas se hace en un turno lleno —"¿de
                        quién es la 7?"— y hasta ahora se contestaba gritando.
                        Va siempre, incluso cuando arriba hay un aviso urgente:
                        saber a quién avisarle es parte del aviso.
                      */}
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-bone-dim">
                        <User className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                          {table.session!.waiter?.name ?? "Sin garzón"}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      <span className="mb-0.5 block text-sm font-medium text-bone-dim">
                        Libre
                      </span>
                      {table.name ?? `${table.seats} lugares`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {opening && (
        <OpenTableSheet table={opening} onClose={() => setOpening(null)} />
      )}
    </>
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
function PorImprimir({ tables }: { tables: TableOverview[] }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const listas = tables.filter((table) => (table.session?.draftItems ?? 0) > 0);

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
        {listas.map((table) => {
          const session = table.session!;
          const estaciones = session.draftStations;

          const destino =
            estaciones.length === 1
              ? estaciones[0] === "BARRA"
                ? "a la barra"
                : "a la cocina"
              : "a cocina y barra";

          return (
            <li key={table.id}>
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
                    Mesa {table.number} · Enviar {session.draftItems}
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

/**
 * Boton de una zona.
 *
 * Filtra la sala sin sacar nada de lugar: la casilla de cada mesa queda donde
 * estaba, solo desaparecen las de las otras zonas. En una terraza de seis
 * mesas eso es la diferencia entre mirar y buscar.
 */
function ZoneTab({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string | null;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex h-11 items-center gap-2 border px-3 text-sm transition-colors",
        active
          ? "border-crimson bg-crimson/10 text-bone"
          : "border-line text-muted hover:border-bone/40 hover:text-bone",
      ].join(" ")}
    >
      {color !== undefined && (
        <span
          className={`size-2 shrink-0 rounded-full ${zoneColor(color).dot}`}
          aria-hidden
        />
      )}
      {label}
      <span className="text-xs text-muted">{count}</span>
    </button>
  );
}
