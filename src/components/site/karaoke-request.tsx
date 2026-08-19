"use client";

import { Check, Loader2, Mic, Music4, Search } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useState, useTransition } from "react";

import { queueKaraokeSong, searchKaraokeSongs } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { HoneypotField, SubmitButton } from "@/components/ui/form";
import { formatDuration } from "@/lib/format";
import { IDLE } from "@/lib/form-state";

/**
 * Mandar una cancion desde la mesa.
 *
 * Es el karaoke entero para quien no trabaja aca: escribe, elige y su cancion
 * queda en la cola. Nadie la revisa, nadie la aprueba y no hay a quien
 * llamar — por eso la pantalla tiene que decir sola en que quedo el pedido,
 * que es lo que hace el mensaje con el numero de turno.
 *
 * El buscador mira primero el catalogo del local y, si de ahi sale poco, le
 * pregunta a YouTube una vez y guarda lo que encuentra. Eso pasa en el
 * servidor: aca solo se muestran canciones que ya son del local, y se eligen
 * por id.
 */

type Track = {
  id: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
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
  const [state, action] = useActionState(queueKaraokeSong, IDLE);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [notice, setNotice] = useState("");
  const [searching, startSearch] = useTransition();

  /** Cancion elegida. Null = todavia no eligio ninguna. */
  const [track, setTrack] = useState<Track | null>(null);
  const [mesa, setMesa] = useState(tableNumber ? String(tableNumber) : "");

  /* Sin busqueda escrita se muestra lo mas cantado del local. */
  const corta = query.trim().length < 2;
  const opciones = corta ? popular : results;

  useEffect(() => {
    if (query.trim().length < 2) return;

    /*
     * Espera larga a proposito: se escribe con el pulgar, y esta búsqueda
     * puede terminar costándole al local una consulta a YouTube. Una consulta
     * por tecla no le sirve a nadie.
     */
    const timer = setTimeout(() => {
      startSearch(async () => {
        const mesaNum = Number.parseInt(mesa, 10);
        const result = await searchKaraokeSongs(
          query,
          Number.isNaN(mesaNum) ? undefined : mesaNum,
        );
        setResults((result.data?.tracks as Track[]) ?? []);
        setNotice(result.message ?? "");
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [query, mesa]);

  if (state.status === "success") {
    const enCola = state.data?.estado === "en-cola";

    return (
      <div className="card-bz flex flex-col items-center gap-4 p-8 text-center">
        {enCola ? (
          <Mic className="size-10 text-crimson-bright" aria-hidden />
        ) : (
          <Check className="size-10 text-emerald-300" aria-hidden />
        )}

        <p className="font-display text-2xl text-bone">
          {enCola ? "¡Estás en la cola!" : "¡Anotado!"}
        </p>
        <p className="text-sm text-muted">{state.message}</p>

        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="mt-2"
        >
          Mandar otra canción
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

      {/* La canción: se busca y se elige una. */}
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
              setNotice("");
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

        {!corta && (
          <p className="text-xs text-muted-dark">
            Elige la versión que quieras: la que dice <em>karaoke</em> o{" "}
            <em>instrumental</em> suele ser la que trae la letra en pantalla.
          </p>
        )}

        {/* La elegida viaja por id; si no eligió ninguna, lo escrito va como
            texto y el equipo le busca el video. El servidor exige una de las
            dos. */}
        <input type="hidden" name="trackId" value={track?.id ?? ""} />
        <input
          type="hidden"
          name="requestText"
          value={track ? "" : query.trim()}
        />

        {corta && popular.length > 0 && (
          <p className="text-xs text-muted-dark">
            Lo más cantado en el local esta temporada:
          </p>
        )}

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
                      "flex w-full items-center gap-3 border p-2 text-left transition-colors",
                      chosen
                        ? "border-crimson bg-crimson/12"
                        : "border-line bg-ink-soft hover:border-bone/30",
                    ].join(" ")}
                  >
                    {option.thumbnailUrl ? (
                      <Image
                        src={option.thumbnailUrl}
                        alt=""
                        width={96}
                        height={54}
                        unoptimized
                        className="h-[54px] w-24 shrink-0 object-cover"
                      />
                    ) : (
                      <span className="flex h-[54px] w-24 shrink-0 items-center justify-center border border-line text-muted">
                        <Music4 className="size-5" aria-hidden />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm text-bone">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {[
                          option.channel,
                          formatDuration(option.durationSeconds),
                          option.timesQueued > 0
                            ? `${option.timesQueued} ${option.timesQueued === 1 ? "vez" : "veces"} aquí`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>

                    {chosen && (
                      <Check
                        className="size-4 shrink-0 text-crimson-bright"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          !corta &&
          !searching && (
            <p className="border border-line bg-ink-soft px-4 py-3 text-sm text-muted">
              No encontramos esa canción. Déjala escrita arriba y la buscamos
              nosotros, o prueba con otras palabras.
            </p>
          )
        )}

        {notice && (
          <p className="border border-gilt/40 bg-gilt/10 px-4 py-3 text-sm text-gilt-soft">
            {notice}
          </p>
        )}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-crimson-bright">
          {state.message}
        </p>
      )}

      <SubmitRequest
        elegida={Boolean(track)}
        disabled={!track && query.trim().length < 2}
      />
    </form>
  );
}

/**
 * El boton dice lo que va a pasar de verdad.
 *
 * Con una cancion elegida entra sola a la cola, y prometerlo es lo que evita
 * que la mesa venga a preguntar. Sin elegir ninguna, lo escrito queda para que
 * el equipo le busque el video, y eso no se puede prometer igual de rapido.
 */
function SubmitRequest({
  elegida,
  disabled,
}: {
  elegida: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SubmitButton size="lg" disabled={disabled} pendingLabel="Mandando…">
        <Mic className="size-4" aria-hidden />
        {elegida ? "Mandar a la cola" : "Dejarla anotada"}
      </SubmitButton>
      <p className="text-center text-xs text-muted-dark">
        {elegida
          ? "Entra sola a la cola y sale en la pantalla cuando te toque."
          : "Sin elegir una versión, el equipo tiene que buscarte el video."}
      </p>
    </div>
  );
}
