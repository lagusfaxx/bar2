"use client";

import { Check, Loader2, Mic, Search } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

import { requestKaraokeSong, searchKaraokeCatalog } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { HoneypotField, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/form-state";

/**
 * Pedir una cancion desde la mesa.
 *
 * Quien llega aca escaneo el QR de su mesa con una mano y el trago en la otra,
 * asi que el formulario pide lo minimo: como llamarlo por el microfono y que
 * quiere cantar. La mesa ya viene en el QR.
 *
 * La lista que se busca es la del local, no YouTube: es instantanea, no gasta
 * la cuota de la API y evita que desde la calle se pueda vaciar. Si la cancion
 * no esta, se escribe con palabras y el encargado le busca el video.
 */

type Track = {
  id: string;
  title: string;
  channel: string | null;
  timesQueued: number;
};

export function KaraokeRequestForm({
  tableNumber,
  popular,
}: {
  /** Numero que venia en el QR. Null si entraron a /karaoke a secas. */
  tableNumber: number | null;
  /** Lo mas cantado del local: el punto de partida cuando no saben que pedir. */
  popular: Track[];
}) {
  const [state, action] = useActionState(requestKaraokeSong, IDLE);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, startSearch] = useTransition();

  /** Cancion del catalogo elegida. Null = la van a escribir a mano. */
  const [track, setTrack] = useState<Track | null>(null);
  const [mesa, setMesa] = useState(tableNumber ? String(tableNumber) : "");

  /* Sin busqueda escrita se muestra lo mas cantado del local. */
  const corta = query.trim().length < 2;
  const opciones = corta ? popular : results;

  useEffect(() => {
    if (query.trim().length < 2) return;

    // Media espera antes de consultar: se escribe con el pulgar y una consulta
    // por tecla no le sirve a nadie.
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchKaraokeCatalog(query);
        setResults((result.data?.tracks as Track[]) ?? []);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  if (state.status === "success") {
    return (
      <div className="card-bz flex flex-col items-center gap-4 p-8 text-center">
        <Check className="size-10 text-emerald-300" aria-hidden />
        <p className="font-display text-2xl text-bone">¡Anotado!</p>
        <p className="text-sm text-muted">{state.message}</p>

        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="mt-2"
        >
          Pedir otra canción
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <HoneypotField />

      <label className="flex flex-col gap-2">
        <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-bone-dim">
          ¿Cómo te llamamos por el micrófono?
          <span className="ml-1 text-crimson">*</span>
        </span>
        <input
          type="text"
          name="singer"
          required
          maxLength={60}
          placeholder="Tu nombre o apodo"
          className="h-12 w-full border border-line bg-ink-soft px-4 text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
        />
        {state.errors?.singer && (
          <span role="alert" className="text-xs text-crimson-bright">
            {state.errors.singer}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-bone-dim">
          Tu mesa
        </span>
        <input
          type="number"
          name="tableNumber"
          inputMode="numeric"
          min={1}
          max={999}
          value={mesa}
          onChange={(event) => setMesa(event.target.value)}
          placeholder="Número de tu mesa"
          className="h-12 w-full border border-line bg-ink-soft px-4 text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
        />
        <span className="text-xs text-muted-dark">
          {tableNumber
            ? "Viene del código de tu mesa. Cámbialo si te cambiaste de lugar."
            : "Sirve para ir a buscarte cuando llegue tu turno."}
        </span>
        {state.errors?.tableNumber && (
          <span role="alert" className="text-xs text-crimson-bright">
            {state.errors.tableNumber}
          </span>
        )}
      </label>

      {/* La canción: se elige de la lista del local o se escribe. */}
      <div className="flex flex-col gap-3">
        <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-bone-dim">
          ¿Qué vas a cantar?
        </span>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTrack(null);
            }}
            placeholder="Artista o canción…"
            className="h-12 w-full border border-line bg-ink-soft pl-11 pr-4 text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
          />
          {searching && (
            <Loader2
              className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted"
              aria-hidden
            />
          )}
        </div>

        {/* La elegida viaja al servidor por id; lo escrito, como texto. Una de
            las dos, nunca las dos: el servidor exige exactamente eso. */}
        <input type="hidden" name="trackId" value={track?.id ?? ""} />
        <input
          type="hidden"
          name="requestText"
          value={track ? "" : query.trim()}
        />

        {opciones.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {opciones.map((option) => {
              const chosen = track?.id === option.id;

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => setTrack(chosen ? null : option)}
                    aria-pressed={chosen}
                    className={[
                      "flex w-full items-center justify-between gap-3 border px-4 py-3 text-left transition-colors",
                      chosen
                        ? "border-crimson bg-crimson/12"
                        : "border-line bg-ink-soft hover:border-bone/30",
                    ].join(" ")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-bone">
                        {option.title}
                      </span>
                      {option.channel && (
                        <span className="block truncate text-xs text-muted">
                          {option.channel}
                        </span>
                      )}
                    </span>

                    {chosen && (
                      <Check className="size-4 shrink-0 text-crimson-bright" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border border-line bg-ink-soft px-4 py-3 text-sm text-muted">
            Esa canción todavía no está en la lista del local. Déjala escrita
            arriba y la buscamos nosotros.
          </p>
        )}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-crimson-bright">
          {state.message}
        </p>
      )}

      <SubmitRequest disabled={!track && query.trim().length < 2} />
    </form>
  );
}

/**
 * El boton dice lo que va a pasar: el pedido no entra solo a la cola, lo
 * revisa alguien de sala. Prometer menos evita el reclamo de "pedi hace media
 * hora y no me llamaron".
 */
function SubmitRequest({ disabled }: { disabled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <SubmitButton size="lg" disabled={disabled} pendingLabel="Anotando…">
        <Mic className="size-4" aria-hidden />
        Pedir mi canción
      </SubmitButton>
      <p className="text-center text-xs text-muted-dark">
        Queda esperando a que el equipo la revise. Te llamamos por el micrófono
        cuando sea tu turno.
      </p>
    </div>
  );
}
