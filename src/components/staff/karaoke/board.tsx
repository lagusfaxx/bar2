"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Loader2,
  Mic,
  Play,
  Search,
  SkipForward,
  Trash2,
  Tv,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  acceptRequest,
  blockTrack,
  discardEntry,
  moveEntry,
  playNext,
  queueSong,
  resolveRequest,
  searchLocalCatalog,
  searchYoutube,
  setKaraokeOpen,
  startEntry,
} from "@/app/actions/karaoke";
import { IDLE, type FormState } from "@/lib/form-state";
import type { KaraokeBoard as Board, KaraokeEntryView } from "@/lib/karaoke";

/**
 * Tablero del karaoke.
 *
 * Lo maneja una sola persona con el telefono en la mano mientras camina entre
 * las mesas, asi que todo esta pensado para el pulgar: una columna, botones
 * altos y ninguna accion escondida detras de un menu.
 *
 * El orden de la pantalla es el orden de la noche: quien canta ahora arriba de
 * todo, despues lo que las mesas estan pidiendo —que es lo que hay que
 * responder rapido para que nadie quede esperando— y recien despues la cola.
 */

/** Una cancion elegida en el buscador, lista para encolar. */
type Candidate = {
  videoId: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

type CatalogTrack = Candidate & { id: string; timesQueued: number };

export function KaraokeBoard({
  board,
  tables,
  youtubeReady,
}: {
  board: Board;
  tables: Array<{ id: string; number: number; name: string | null }>;
  /** Hay YOUTUBE_API_KEY en el servidor: sin ella solo sirve el catálogo. */
  youtubeReady: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  /*
   * El tablero se mira desde varios lugares a la vez —el encargado en su
   * telefono, la TV en la pared, las mesas pidiendo por el QR—, asi que se
   * refresca solo. Diez segundos es el mismo ritmo que usan cocina y barra.
   */
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);

  /** A donde va lo que se elija en el buscador. */
  const [picker, setPicker] = useState<
    { mode: "cola" } | { mode: "pedido"; entry: KaraokeEntryView } | null
  >(null);

  const run = (action: () => Promise<FormState>) => {
    startTransition(async () => {
      setFeedback(await action());
      router.refresh();
    });
  };

  return (
    <>
      <header className="shrink-0 border-b border-line bg-ink pt-safe">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-none">
          <Link
            href="/staff"
            aria-label="Volver al panel de sala"
            className="flex size-10 shrink-0 items-center justify-center border border-line text-bone"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>

          <h1 className="flex min-w-0 flex-1 items-center gap-2 font-display text-xl text-bone">
            <Mic className="size-5 shrink-0 text-crimson-bright" aria-hidden />
            Karaoke
          </h1>

          <Link
            href="/staff/karaoke/pantalla"
            target="_blank"
            className="flex h-10 items-center gap-2 border border-line px-3 text-sm text-muted hover:border-crimson hover:text-crimson-bright"
          >
            <Tv className="size-4" aria-hidden />
            Pantalla
          </Link>
        </div>

        {/*
          El interruptor de la noche.

          Cerrado, el QR de las mesas avisa que hoy no hay karaoke en vez de
          juntar pedidos que nadie va a mirar. Dice en palabras que significa
          cada estado: "abierto/cerrado" solo, sin la consecuencia, obliga a
          probar para entender.
        */}
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 border-t border-line px-4 py-2.5 lg:max-w-none">
          <p className="text-xs text-muted">
            {board.open
              ? "Abierto: las mesas pueden pedir desde su QR."
              : "Cerrado: las mesas ven que hoy no hay karaoke."}
          </p>

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setKaraokeOpen(!board.open))}
            className={[
              "h-9 shrink-0 border px-3 text-sm",
              board.open
                ? "border-emerald-500/50 text-emerald-200"
                : "border-line text-muted",
            ].join(" ")}
          >
            {board.open ? "Cerrar karaoke" : "Abrir karaoke"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full min-h-0 max-w-2xl flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4 lg:max-w-none lg:px-6">
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

        {/* Cantando ahora */}
        <section>
          <h2 className="font-display text-lg text-bone">Cantando ahora</h2>

          {board.singing ? (
            <div className="mt-3 border border-crimson/50 bg-crimson/10 p-4">
              <p className="font-display text-2xl text-bone">
                {board.singing.singer}
                {board.singing.tableNumber && (
                  <span className="ml-2 text-sm text-muted">
                    mesa {board.singing.tableNumber}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-bone-dim">
                {board.singing.track?.title ?? board.singing.requestText}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => playNext())}
                  className="flex h-12 flex-1 items-center justify-center gap-2 bg-crimson text-base text-bone disabled:opacity-60"
                >
                  <SkipForward className="size-5" aria-hidden />
                  Terminó, va el siguiente
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => discardEntry(board.singing!.id))}
                  aria-label="Descartar el turno"
                  className="flex size-12 items-center justify-center border border-line text-muted hover:border-crimson hover:text-crimson-bright"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 border border-line bg-ink-soft p-4 text-center">
              <p className="text-sm text-muted">
                No hay nadie cantando en este momento.
              </p>

              {board.queue.length > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => playNext())}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 bg-crimson text-base text-bone disabled:opacity-60"
                >
                  <Play className="size-5" aria-hidden />
                  Empezar con {board.queue[0].singer}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Pedidas desde las mesas: lo que hay que responder rapido */}
        {board.requests.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 font-display text-lg text-bone">
              Pidieron desde las mesas
              <span className="rounded-[2px] bg-gilt px-1.5 py-0.5 text-xs font-bold text-ink">
                {board.requests.length}
              </span>
            </h2>

            <ul className="mt-3 flex flex-col gap-2">
              {board.requests.map((entry) => (
                <li key={entry.id} className="border border-gilt/40 bg-ink-soft p-3">
                  <p className="text-bone">
                    {entry.singer}
                    {entry.tableNumber && (
                      <span className="ml-2 text-sm text-muted">
                        mesa {entry.tableNumber}
                      </span>
                    )}
                  </p>

                  <p className="mt-0.5 text-sm text-bone-dim">
                    {entry.track?.title ?? entry.requestText}
                  </p>

                  {!entry.track && (
                    <p className="mt-1 text-xs text-gilt-soft">
                      Lo escribieron a mano: hay que buscarle el video.
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    {entry.track ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => acceptRequest(entry.id))}
                        className="h-11 flex-1 bg-crimson text-sm text-bone disabled:opacity-60"
                      >
                        Aceptar y poner en la cola
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPicker({ mode: "pedido", entry })}
                        className="flex h-11 flex-1 items-center justify-center gap-2 border border-bone/25 text-sm text-bone"
                      >
                        <Search className="size-4" aria-hidden />
                        Buscarle el video
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => discardEntry(entry.id))}
                      aria-label="Descartar el pedido"
                      className="flex size-11 items-center justify-center border border-line text-muted hover:border-crimson hover:text-crimson-bright"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* La cola */}
        <section className="mt-8">
          <h2 className="font-display text-lg text-bone">
            La cola{board.queue.length > 0 && ` · ${board.queue.length}`}
          </h2>

          {board.queue.length === 0 ? (
            <p className="mt-3 border border-line bg-ink-soft p-5 text-center text-sm text-muted">
              No hay nadie esperando. Carga la primera canción abajo.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {board.queue.map((entry, index) => (
                <li key={entry.id} className="border border-line bg-ink-soft p-3">
                  <div className="flex items-start gap-3">
                    <span className="font-display text-xl text-muted">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-bone">
                        {entry.singer}
                        {entry.tableNumber && (
                          <span className="ml-2 text-sm text-muted">
                            mesa {entry.tableNumber}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-bone-dim">
                        {entry.track?.title ?? entry.requestText}
                      </p>
                      {entry.note && (
                        <p className="mt-0.5 text-xs text-muted">{entry.note}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        disabled={pending || index === 0}
                        onClick={() => run(() => moveEntry(entry.id, "arriba"))}
                        aria-label={`Subir a ${entry.singer}`}
                        className="flex size-9 items-center justify-center border border-line text-bone disabled:opacity-30"
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={pending || index === board.queue.length - 1}
                        onClick={() => run(() => moveEntry(entry.id, "abajo"))}
                        aria-label={`Bajar a ${entry.singer}`}
                        className="flex size-9 items-center justify-center border border-line text-bone disabled:opacity-30"
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => startEntry(entry.id))}
                      className="h-10 flex-1 border border-bone/25 text-sm text-bone disabled:opacity-60"
                    >
                      Que cante ahora
                    </button>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => discardEntry(entry.id))}
                      aria-label={`Sacar a ${entry.singer} de la cola`}
                      className="flex size-10 items-center justify-center border border-line text-muted hover:border-crimson hover:text-crimson-bright"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Ya cantaron: sirve para saber quien ya paso y no repetirlo */}
        {board.done.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-lg text-bone">Ya cantaron</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {board.done.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-3 border border-line/60 px-3 py-2 text-sm"
                >
                  <span className="text-bone-dim">{entry.singer}</span>
                  <span className="truncate text-xs text-muted">
                    {entry.track?.title ?? entry.requestText}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Cargar una cancion: fijo abajo, como el boton de cobrar del POS */}
      <div className="shrink-0 border-t border-line bg-ink pb-safe">
        <div className="mx-auto max-w-2xl px-4 py-3 lg:max-w-none">
          <button
            type="button"
            onClick={() => setPicker({ mode: "cola" })}
            className="flex h-14 w-full items-center justify-center gap-2 bg-crimson text-base font-medium text-bone"
          >
            <Search className="size-5" aria-hidden />
            Buscar una canción
          </button>
        </div>
      </div>

      {picker && (
        <SongPicker
          mode={picker.mode}
          entry={picker.mode === "pedido" ? picker.entry : null}
          tables={tables}
          youtubeReady={youtubeReady}
          onDone={(result) => {
            setFeedback(result);
            setPicker(null);
            router.refresh();
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

/**
 * Buscador de canciones.
 *
 * Busca en dos lugares distintos y lo dice con todas las letras, porque no
 * cuestan lo mismo: el catalogo del local es gratis e instantaneo, y cada
 * busqueda en YouTube gasta una de las cien que el local tiene por dia. Por
 * eso YouTube nunca se consulta solo — hay que apretar el boton.
 */
function SongPicker({
  mode,
  entry,
  tables,
  youtubeReady,
  onDone,
  onClose,
}: {
  mode: "cola" | "pedido";
  entry: KaraokeEntryView | null;
  tables: Array<{ id: string; number: number; name: string | null }>;
  youtubeReady: boolean;
  onDone: (result: FormState) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(entry?.requestText ?? "");
  const [catalog, setCatalog] = useState<CatalogTrack[]>([]);
  const [videos, setVideos] = useState<Candidate[]>([]);
  const [notice, setNotice] = useState<FormState>(IDLE);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  /** Cancion elegida, esperando saber quien la canta. */
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [singer, setSinger] = useState(entry?.singer ?? "");
  const [tableId, setTableId] = useState("");

  /** Con menos de dos letras no se muestra nada, sin tocar el estado. */
  const corta = query.trim().length < 2;
  const catalogo = corta ? [] : catalog;

  /*
   * El catalogo se consulta solo mientras se escribe: no cuesta nada y evita
   * gastar una busqueda de YouTube en una cancion que el local ya tiene. La
   * espera de 400 ms es para no disparar una consulta por tecla.
   */
  useEffect(() => {
    if (query.trim().length < 2) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchLocalCatalog(query);
        setCatalog((result.data?.tracks as CatalogTrack[]) ?? []);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const lookUpYoutube = () => {
    startSearch(async () => {
      const result = await searchYoutube(query);
      setNotice(result);
      setVideos((result.data?.videos as Candidate[]) ?? []);
    });
  };

  const confirm = () => {
    if (!chosen) return;

    const formData = new FormData();
    formData.set("videoId", chosen.videoId);
    formData.set("title", chosen.title);
    if (chosen.channel) formData.set("channel", chosen.channel);
    if (chosen.durationSeconds !== null) {
      formData.set("durationSeconds", String(chosen.durationSeconds));
    }
    if (chosen.thumbnailUrl) formData.set("thumbnailUrl", chosen.thumbnailUrl);

    startSave(async () => {
      if (mode === "pedido" && entry) {
        formData.set("entryId", entry.id);
        onDone(await resolveRequest(IDLE, formData));
        return;
      }

      formData.set("singer", singer);
      formData.set("tableId", tableId);
      onDone(await queueSong(IDLE, formData));
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-ink">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 pt-safe">
        <h2 className="min-w-0 flex-1 font-display text-lg text-bone">
          {mode === "pedido"
            ? `Video para ${entry?.singer}`
            : "Buscar una canción"}
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el buscador"
          className="flex size-10 items-center justify-center border border-line text-bone"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="shrink-0 border-b border-line px-4 py-3">
        <input
          type="search"
          value={query}
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            // Los resultados de YouTube son de la busqueda anterior: dejarlos
            // debajo de otra palabra escrita confunde sobre que se esta viendo.
            setVideos([]);
            setNotice(IDLE);
          }}
          placeholder="Artista y canción…"
          className="h-12 w-full border border-line bg-ink-soft px-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
        />

        <button
          type="button"
          disabled={searching || query.trim().length < 2 || !youtubeReady}
          onClick={lookUpYoutube}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 border border-bone/25 text-sm text-bone disabled:opacity-40"
        >
          {searching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Video className="size-4" aria-hidden />
          )}
          Buscar en YouTube
        </button>

        <p className="mt-1.5 text-xs text-muted">
          {youtubeReady
            ? "El local tiene 100 búsquedas de YouTube al día. Lo que ya está en el catálogo no gasta ninguna."
            : "Falta configurar YOUTUBE_API_KEY: por ahora solo se puede elegir del catálogo del local."}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {notice.status === "error" && (
          <p role="alert" className="mb-4 text-sm text-crimson-bright">
            {notice.message}
          </p>
        )}

        {catalogo.length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
              En el catálogo del local
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {catalogo.map((track) => (
                <SongRow
                  key={track.id}
                  song={track}
                  hint={
                    track.timesQueued > 0
                      ? `Cantada ${track.timesQueued} ${track.timesQueued === 1 ? "vez" : "veces"}`
                      : null
                  }
                  onPick={() => setChosen(track)}
                  onBlock={() => blockTrack(track.id)}
                />
              ))}
            </ul>
          </section>
        )}

        {videos.length > 0 && (
          <section className="mt-6">
            <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
              Resultados de YouTube
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {videos.map((video) => (
                <SongRow
                  key={video.videoId}
                  song={video}
                  hint={null}
                  onPick={() => setChosen(video)}
                />
              ))}
            </ul>
          </section>
        )}

        {catalogo.length === 0 && videos.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted">
            {corta
              ? "Escribe el nombre de la canción."
              : "Nada en el catálogo. Prueba buscando en YouTube."}
          </p>
        )}
      </div>

      {/* Elegida la cancion, falta lo unico que la pantalla no puede saber:
          quien la canta. En modo pedido eso ya vino desde la mesa. */}
      {chosen && (
        <div className="shrink-0 border-t border-line bg-ink-soft px-4 py-4 pb-safe">
          <p className="truncate text-sm text-bone">{chosen.title}</p>

          {mode === "cola" && (
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="text"
                value={singer}
                onChange={(event) => setSinger(event.target.value)}
                placeholder="¿Quién canta? (como se le llama por el micrófono)"
                className="h-12 w-full border border-line bg-ink px-3 text-bone placeholder:text-muted focus:border-crimson focus:outline-none"
              />

              <select
                value={tableId}
                onChange={(event) => setTableId(event.target.value)}
                className="h-12 w-full border border-line bg-ink px-3 text-bone focus:border-crimson focus:outline-none"
              >
                <option value="">Sin mesa</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    Mesa {table.number}
                    {table.name ? ` · ${table.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="h-12 flex-1 border border-line text-sm text-muted"
            >
              Elegir otra
            </button>

            <button
              type="button"
              disabled={saving || (mode === "cola" && singer.trim().length < 2)}
              onClick={confirm}
              className="flex h-12 flex-[1.4] items-center justify-center gap-2 bg-crimson text-sm text-bone disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {mode === "pedido" ? "Asignar y poner en la cola" : "A la cola"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Una fila de resultado, igual venga del catálogo o de YouTube. */
function SongRow({
  song,
  hint,
  onPick,
  onBlock,
}: {
  song: Candidate;
  hint: string | null;
  onPick: () => void;
  /** Solo el catálogo se puede podar: lo de YouTube todavía no es del local. */
  onBlock?: () => Promise<FormState>;
}) {
  const [hiding, startHide] = useTransition();
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <li className="flex items-center gap-3 border border-line bg-ink-soft p-2">
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {song.thumbnailUrl ? (
          <Image
            src={song.thumbnailUrl}
            alt=""
            width={96}
            height={54}
            unoptimized
            className="h-[54px] w-24 shrink-0 object-cover"
          />
        ) : (
          <span className="flex h-[54px] w-24 shrink-0 items-center justify-center border border-line text-muted">
            <Video className="size-5" aria-hidden />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm text-bone">{song.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {[song.channel, hint].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>

      {onBlock && (
        <button
          type="button"
          disabled={hiding}
          aria-label="Sacar del catálogo"
          title="Sacar del catálogo"
          onClick={() =>
            startHide(async () => {
              await onBlock();
              setHidden(true);
            })
          }
          className="flex size-9 shrink-0 items-center justify-center border border-line text-muted hover:border-crimson hover:text-crimson-bright"
        >
          <EyeOff className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
