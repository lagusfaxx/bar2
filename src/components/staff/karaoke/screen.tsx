"use client";

import { Mic, Music4 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { playNext } from "@/app/actions/karaoke";
import { formatDuration } from "@/lib/format";
import type { KaraokeEntryView } from "@/lib/karaoke";

/**
 * La pantalla que se proyecta en el local.
 *
 * Queda encendida toda la noche sin que nadie la toque: reproduce el turno que
 * esta cantando, y cuando el video termina cierra ese turno y arranca el
 * siguiente sola. Debajo del video van los que siguen, que es lo que la gente
 * mira para saber cuanto le falta.
 *
 * Sobre los avisos: no hay forma de "conectar" YouTube Premium desde el
 * codigo. El reproductor incrustado respeta la sesion del navegador que lo
 * muestra, asi que la unica manera de que no salgan avisos es dejar esta
 * pantalla abierta en un navegador con la cuenta Premium del local iniciada.
 */

type Player = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  destroy: () => void;
};

type YT = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => Player;
  PlayerState: { ENDED: number };
};

declare global {
  interface Window {
    YT?: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Carga la API del reproductor una sola vez por pestaña. */
function loadIframeApi(): Promise<YT> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };

    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.body.append(script);
    }
  });
}

export function KaraokeScreen({
  singing,
  queue,
}: {
  singing: KaraokeEntryView | null;
  queue: KaraokeEntryView[];
}) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [, startTransition] = useTransition();

  /** El video que el reproductor tiene cargado ahora mismo. */
  const [loaded, setLoaded] = useState<string | null>(null);

  /** El reproductor de YouTube no llego a cargar (sin internet, o bloqueado). */
  const [sinReproductor, setSinReproductor] = useState(false);

  const videoId = singing?.track?.videoId ?? null;

  /*
   * Termino la cancion: se cierra el turno y arranca el siguiente.
   *
   * El servidor decide quien sigue, no esta pantalla — asi el encargado puede
   * haber reordenado la cola un segundo antes y el orden que manda sigue
   * siendo el suyo.
   */
  const advance = useCallback(() => {
    startTransition(async () => {
      await playNext();
      router.refresh();
    });
  }, [router]);

  /* La cola cambia desde el telefono del encargado: hay que ir a buscarla. */
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);

  /*
   * Nadie cantando pero gente esperando: se arranca sola.
   *
   * Es lo que hace que la noche corra sin que nadie toque la pantalla —el
   * encargado carga la cola desde su telefono y aca empieza a sonar—.
   */
  useEffect(() => {
    if (!singing && queue.length > 0) advance();
  }, [singing, queue.length, advance]);

  useEffect(() => {
    if (!videoId || !holder.current) return;

    let cancelled = false;

    /*
     * Si la API no llega, hay que decirlo.
     *
     * Sin esto la pantalla se queda en negro para siempre y nadie en el local
     * sabe si el problema es el video, la cola o internet. Diez segundos es
     * mas que suficiente en cualquier conexion que sirva para reproducir.
     */
    const aviso = setTimeout(() => {
      if (!cancelled && !player.current) setSinReproductor(true);
    }, 10_000);

    loadIframeApi().then((YT) => {
      clearTimeout(aviso);
      if (cancelled || !holder.current) return;

      setSinReproductor(false);

      if (!player.current) {
        player.current = new YT.Player(holder.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            // Sin controles: la pantalla se mira, no se toca. Quien manda es
            // el encargado desde su telefono.
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) advance();
            },
            // Video caido, bloqueado o privado: en vez de dejar la pantalla en
            // negro con la gente esperando, se pasa al siguiente.
            onError: () => advance(),
          },
        });
        setLoaded(videoId);
        return;
      }

      if (loaded !== videoId) {
        player.current.loadVideoById(videoId);
        setLoaded(videoId);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(aviso);
    };
  }, [videoId, loaded, advance]);

  return (
    <div className="flex h-[100dvh] flex-col bg-ink">
      <div className="relative min-h-0 flex-1 bg-black">
        {/* El reproductor se monta sobre este div; el contenedor se queda
            vacio cuando no hay nadie cantando. */}
        <div ref={holder} className="size-full" />

        {sinReproductor && videoId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/90 p-8 text-center">
            <p className="font-display text-3xl text-bone">
              No se pudo cargar el reproductor de YouTube
            </p>
            <p className="max-w-xl text-lg text-muted">
              Revisa la conexión del local. La cola queda guardada: apenas
              vuelva internet, esta pantalla sigue sola desde donde estaba.
            </p>
          </div>
        )}

        {!videoId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <Music4 className="size-16 text-crimson-bright" aria-hidden />
            <p className="font-display text-4xl text-bone">
              {queue.length > 0
                ? "Preparando la próxima canción…"
                : "Karaoke listo"}
            </p>
            {queue.length === 0 && (
              <p className="max-w-xl text-lg text-muted">
                Pide tu canción con el QR de tu mesa o pídesela al garzón.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Franja de abajo: quien canta y quienes siguen, en letra de mirar de
          lejos. Es la unica informacion que la gente del local necesita. */}
      <div className="shrink-0 border-t border-line bg-ink px-6 py-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="flex items-center gap-3 font-display text-3xl text-bone">
            <Mic className="size-7 text-crimson-bright" aria-hidden />
            {singing ? singing.singer : "—"}
            {singing?.tableNumber && (
              <span className="text-lg text-muted">
                mesa {singing.tableNumber}
              </span>
            )}
          </p>

          {singing?.track && (
            <p className="text-lg text-bone-dim">
              {singing.track.title}
              {formatDuration(singing.track.durationSeconds) && (
                <span className="ml-2 text-muted">
                  {formatDuration(singing.track.durationSeconds)}
                </span>
              )}
            </p>
          )}
        </div>

        {queue.length > 0 && (
          <p className="mt-2 truncate text-xl text-muted">
            <span className="text-bone-dim">Siguen:</span>{" "}
            {queue
              .slice(0, 5)
              .map((entry) =>
                entry.tableNumber
                  ? `${entry.singer} (mesa ${entry.tableNumber})`
                  : entry.singer,
              )
              .join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
