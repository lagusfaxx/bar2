"use client";

import {
  AlertCircle,
  Camera,
  CameraOff,
  Check,
  Loader2,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { lookupCard, redeemPromotion, type CardLookup } from "@/app/actions/admin/loyalty";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/section";
import { formatCardNumber, promotionValueLabel, TIER_LABELS } from "@/lib/format";
import { IDLE, type FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

/**
 * Herramienta de sala para verificar una BarzuCard y canjear promociones.
 *
 * El camino habitual es otro: el socio elige el descuento en su BarzuCard y
 * muestra el QR de ese cupón, que lleva directo a la pantalla de confirmación.
 * Esta pantalla es el respaldo para cuando eso no pasa —tarjeta física, socio
 * que no sabe usar la web, cupón vencido— y por eso sigue permitiendo elegir la
 * promoción a mano.
 *
 * Tres formas de identificar la tarjeta, en orden de comodidad:
 *  1. La cámara del propio teléfono. Se usa BarcodeDetector cuando el navegador
 *     lo trae (Chrome en Android) y, si no, un decodificador en JavaScript, que
 *     es lo que hace funcionar el escaneo en el Safari del iPhone.
 *  2. La cámara nativa del sistema: el QR contiene la URL /staff/verificar/…
 *     y abre esta misma pantalla ya resuelta.
 *  3. Los 16 dígitos escritos a mano, con verificación de dígito de control.
 *
 * Si lo escaneado resulta ser el cupón de un descuento, se deriva a la
 * pantalla de ese cupón. La decisión de si una promoción se puede canjear la
 * toma siempre el servidor.
 */
export function CardVerifier({ initial }: { initial?: CardLookup }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(IDLE);
  const [lookup, setLookup] = useState<CardLookup | null>(initial ?? null);
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  /**
   * Último canje confirmado. Se guarda aquí arriba y no en la fila de la
   * promoción porque, al canjearse, esa fila pasa a "no disponibles" y se
   * desmonta: el comprobante tiene que sobrevivir para que el equipo de sala
   * pueda mostrárselo al cliente.
   */
  const [lastRedemption, setLastRedemption] = useState<{
    title: string;
    receiptCode: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * La Server Action se invoca desde la transición para poder usar su resultado
   * en el mismo callback, sin sincronizarlo después con un efecto.
   */
  const action = (formData: FormData) => {
    setLastRedemption(null);

    startTransition(async () => {
      const result = await lookupCard(IDLE, formData);

      // Si lo escaneado era el cupón de un descuento, la promoción ya está
      // elegida: se va derecho a confirmarla en vez de listar la tarjeta.
      const redirectTo = result.data?.redirectTo;
      if (result.status === "success" && typeof redirectTo === "string") {
        router.push(redirectTo);
        return;
      }

      setState(result);

      const found = result.data?.lookup as CardLookup | undefined;
      if (result.status === "success" && found) setLookup(found);
    });
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    setScanError(null);

    // Los navegadores solo entregan la camara en sitios seguros. Si el local
    // todavia entra por http://, conviene decirlo con todas las letras: es la
    // causa mas habitual de que el boton "no haga nada".
    if (!window.isSecureContext) {
      setScanError(
        "La cámara solo funciona con https://. Mientras el sitio esté en http, abre la cámara del teléfono y apunta al QR de la tarjeta: se abre esta misma pantalla con los datos del socio.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError(
        "Este navegador no da acceso a la cámara. Abre la cámara del teléfono y apunta al QR de la tarjeta: se abre esta misma pantalla.",
      );
      return;
    }

    /**
     * Lector de QR. Se prefiere BarcodeDetector porque lo resuelve el sistema
     * operativo; cuando no existe —Safari, Firefox— se carga jsQR bajo demanda,
     * para no sumar peso a quienes no lo necesitan.
     */
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    const native = Detector ? new Detector({ formats: ["qr_code"] }) : null;
    const jsQR = native ? null : (await import("jsqr")).default;

    const readFrame = async (video: HTMLVideoElement): Promise<string | null> => {
      if (native) {
        const codes = await native.detect(video);
        return codes[0]?.rawValue ?? null;
      }

      if (!jsQR || !video.videoWidth) return null;

      // Se decodifica sobre un lienzo reducido: alcanza para leer el QR y
      // mantiene la busqueda fluida en telefonos modestos.
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      const side = Math.min(video.videoWidth, video.videoHeight, 640);
      canvas.width = side;
      canvas.height = side;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      context.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        side,
        side,
      );

      const image = context.getImageData(0, 0, side, side);
      return jsQR(image.data, side, side, { inversionAttempts: "dontInvert" })?.data ?? null;
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // La cámara trasera es la que apunta a la tarjeta del cliente.
        video: { facingMode: { ideal: "environment" } },
      });

      streamRef.current = stream;
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS solo reproduce en linea y sin sonido; sin esto la imagen se
        // abriria a pantalla completa y el escaneo no llegaria a empezar.
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
      }

      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;

        try {
          const value = await readFrame(videoRef.current);

          if (value) {
            stopCamera();
            if (inputRef.current) inputRef.current.value = value;
            formRef.current?.requestSubmit();
            return;
          }
        } catch {
          // Un fotograma ilegible no es un error: seguimos con el siguiente.
        }

        requestAnimationFrame(() => void tick());
      };

      requestAnimationFrame(() => void tick());
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");

      setScanError(
        denied
          ? "El navegador bloqueó la cámara. Permítela para este sitio en los ajustes del teléfono y vuelve a intentarlo. Mientras tanto puedes escribir los 16 dígitos."
          : "No pudimos abrir la cámara. Revisa que ninguna otra aplicación la esté usando, o escribe los 16 dígitos.",
      );
      stopCamera();
    }
  }, [stopCamera]);

  const reset = () => {
    setLookup(null);
    setScanError(null);
    setLastRedemption(null);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Búsqueda */}
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <label
          htmlFor="code"
          className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase"
        >
          Número de tarjeta, QR o código de cupón
        </label>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="code"
            name="code"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="5210 •••• •••• ••••  ·  BZD-••••••"
            defaultValue={initial?.card.cardNumber}
            className="min-w-0 flex-1 border border-line bg-ink-soft px-4 py-4 font-mono text-lg tracking-[0.12em] text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
          />

          <button
            type="submit"
            disabled={pending}
            aria-label="Buscar tarjeta"
            className="flex size-[3.75rem] shrink-0 items-center justify-center bg-crimson text-bone transition-colors hover:bg-crimson-bright disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Search className="size-5" aria-hidden />
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={scanning ? stopCamera : startCamera}
            className="flex items-center gap-2 border border-line px-4 py-3 text-[0.65rem] font-medium tracking-[0.16em] text-bone-dim uppercase transition-colors hover:border-crimson hover:text-bone"
          >
            {scanning ? (
              <>
                <CameraOff className="size-4" aria-hidden />
                Detener cámara
              </>
            ) : (
              <>
                <Camera className="size-4" aria-hidden />
                Escanear QR
              </>
            )}
          </button>

          {lookup && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-2 border border-line px-4 py-3 text-[0.65rem] font-medium tracking-[0.16em] text-muted uppercase transition-colors hover:border-crimson hover:text-bone"
            >
              <RotateCcw className="size-4" aria-hidden />
              Nueva búsqueda
            </button>
          )}
        </div>

        {state.status === "error" && state.message && (
          <p
            role="alert"
            className="flex items-start gap-2 border border-crimson/50 bg-crimson/10 px-4 py-3 text-sm text-crimson-bright"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.message}
          </p>
        )}

        {scanError && (
          <p className="border border-line bg-surface px-4 py-3 text-xs text-muted">
            {scanError}
          </p>
        )}
      </form>

      {/* Cámara */}
      <div hidden={!scanning} className="relative overflow-hidden border border-crimson/50">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-square w-full bg-ink object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[18%] border-2 border-crimson/70"
        />
        <p className="absolute inset-x-0 bottom-0 bg-ink/80 py-3 text-center text-xs text-bone-dim">
          Apunta al código QR de la tarjeta
        </p>
      </div>

      {/* Resultado */}
      {lookup && (
        <CardResult
          lookup={lookup}
          onRefresh={setLookup}
          lastRedemption={lastRedemption}
          onRedeemed={setLastRedemption}
        />
      )}
    </div>
  );
}

function CardResult({
  lookup,
  onRefresh,
  lastRedemption,
  onRedeemed,
}: {
  lookup: CardLookup;
  onRefresh: (lookup: CardLookup) => void;
  lastRedemption: { title: string; receiptCode: string } | null;
  onRedeemed: (value: { title: string; receiptCode: string }) => void;
}) {
  const suspended = lookup.card.status !== "ACTIVE";
  const eligible = lookup.promotions.filter((promotion) => promotion.eligible);
  const blocked = lookup.promotions.filter((promotion) => !promotion.eligible);

  return (
    <div className="flex flex-col gap-5">
      {/* Comprobante del último canje: queda a la vista hasta la próxima
          búsqueda, para poder mostrárselo al cliente. */}
      {lastRedemption && (
        <div
          role="status"
          className="border border-emerald-500/50 bg-emerald-500/10 p-5"
        >
          <p className="flex items-center gap-2 font-display text-xl text-emerald-200">
            <Check className="size-5" aria-hidden />
            Canje confirmado
          </p>
          <p className="mt-1 text-sm text-emerald-200/80">
            {lastRedemption.title}
          </p>
          <p className="mt-3 font-mono text-sm tracking-[0.18em] text-emerald-300">
            {lastRedemption.receiptCode}
          </p>
        </div>
      )}

      {/* Ficha del socio */}
      <div
        className={cn(
          "border p-5",
          suspended
            ? "border-crimson bg-crimson/10"
            : "border-line bg-ink-soft",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-2xl text-bone">
              {lookup.member.fullName}
            </p>
            <p className="mt-1 font-mono text-xs tracking-[0.14em] text-muted">
              {formatCardNumber(lookup.card.cardNumber)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge tone={lookup.card.tier === "CLASICA" ? "muted" : "gilt"}>
              {TIER_LABELS[lookup.card.tier]}
            </Badge>
            <span className="flex items-center gap-1.5 text-sm text-gilt-soft">
              <Star className="size-3.5" aria-hidden />
              {lookup.card.points} pts
            </span>
          </div>
        </div>

        {suspended && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-crimson-bright">
            <AlertCircle className="size-4" aria-hidden />
            Tarjeta suspendida — no se puede canjear
          </p>
        )}
      </div>

      {/* Promociones disponibles */}
      <div>
        <h2 className="mb-1.5 text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
          Disponibles ({eligible.length})
        </h2>

        <p className="mb-3 text-xs text-muted-dark">
          Preguntale al cliente cuál quiere usar. Si lo elige desde su BarzuCard
          y te muestra el QR del cupón, esto no hace falta.
        </p>

        {eligible.length === 0 ? (
          <p className="border border-line bg-ink-soft px-5 py-6 text-sm text-muted">
            Esta tarjeta no tiene beneficios disponibles en este momento.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {eligible.map((promotion) => (
              <li key={promotion.id}>
                <RedeemRow
                  cardId={lookup.card.id}
                  promotion={promotion}
                  lookup={lookup}
                  onRefresh={onRefresh}
                  onRedeemed={onRedeemed}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* No disponibles, con el motivo a la vista */}
      {blocked.length > 0 && (
        <details className="border border-line bg-ink-soft">
          <summary className="cursor-pointer px-5 py-4 text-[0.68rem] font-medium tracking-[0.18em] text-muted uppercase">
            No disponibles ({blocked.length})
          </summary>

          <ul className="flex flex-col gap-2 px-5 pb-5">
            {blocked.map((promotion) => (
              <li
                key={promotion.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3"
              >
                <span className="text-sm text-muted">{promotion.title}</span>
                <span className="text-xs text-crimson-bright">
                  {promotion.reason}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Últimos canjes de la tarjeta */}
      {lookup.lastRedemptions.length > 0 && (
        <details className="border border-line bg-ink-soft">
          <summary className="cursor-pointer px-5 py-4 text-[0.68rem] font-medium tracking-[0.18em] text-muted uppercase">
            Últimos canjes ({lookup.lastRedemptions.length})
          </summary>

          <ul className="flex flex-col gap-2 px-5 pb-5">
            {lookup.lastRedemptions.map((redemption) => (
              <li
                key={redemption.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs"
              >
                <span className="text-bone-dim">{redemption.title}</span>
                <span className="font-mono text-muted-dark">
                  {new Intl.DateTimeFormat("es-CL", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(redemption.redeemedAt))}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RedeemRow({
  cardId,
  promotion,
  lookup,
  onRefresh,
  onRedeemed,
}: {
  cardId: string;
  promotion: CardLookup["promotions"][number];
  lookup: CardLookup;
  onRefresh: (lookup: CardLookup) => void;
  onRedeemed: (value: { title: string; receiptCode: string }) => void;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();

  /**
   * Momento en que se pidió confirmación. Guardar el instante (y no un simple
   * booleano) permite descartar el toque que abrió la confirmación: el botón
   * "Confirmar" aparece justo bajo el dedo y, sin esta guarda, el mismo toque
   * llegaba a canjear la promoción sin que nadie la confirmara.
   */
  const [confirmingSince, setConfirmingSince] = useState<number | null>(null);
  const confirming = confirmingSince !== null;

  /**
   * Al confirmar, se actualiza la ficha en pantalla con los puntos nuevos y se
   * marca la promoción como usada, para que el equipo de sala no pueda
   * canjearla dos veces sin volver a escanear.
   */
  const action = (formData: FormData) => {
    // Descarta el mismo toque que acaba de abrir la confirmación.
    if (confirmingSince !== null && Date.now() - confirmingSince < 500) return;

    startTransition(async () => {
      const result = await redeemPromotion(IDLE, formData);
      setState(result);

      if (result.status !== "success") return;

      onRedeemed({
        title: promotion.title,
        receiptCode: String(result.data?.receiptCode ?? ""),
      });

      const points =
        typeof result.data?.points === "number"
          ? result.data.points
          : lookup.card.points;

      onRefresh({
        ...lookup,
        card: { ...lookup.card, points },
        promotions: lookup.promotions.map((item) =>
          item.id === promotion.id
            ? {
                ...item,
                used: item.used + 1,
                eligible: item.maxPerCard === 0 || item.used + 1 < item.maxPerCard,
                reason:
                  item.maxPerCard !== 0 && item.used + 1 >= item.maxPerCard
                    ? "Ya fue canjeada con esta tarjeta"
                    : undefined,
              }
            : item,
        ),
      });
    });
  };

  return (
    <form action={action} className="border border-line bg-ink-soft p-5">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="promotionId" value={promotion.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight text-bone">
            {promotion.title}
          </p>
          <p className="mt-1 text-sm text-muted">{promotion.description}</p>
        </div>

        <Badge tone="crimson" className="shrink-0">
          {promotionValueLabel(promotion.type, promotion.value)}
        </Badge>
      </div>

      {(promotion.pointsCost > 0 || promotion.pointsReward > 0) && (
        <p className="mt-3 text-xs text-gilt-soft">
          {promotion.pointsCost > 0 && `Cuesta ${promotion.pointsCost} pts`}
          {promotion.pointsCost > 0 && promotion.pointsReward > 0 && " · "}
          {promotion.pointsReward > 0 && `Suma ${promotion.pointsReward} pts`}
        </p>
      )}

      {promotion.terms && confirming && (
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted-dark">
          {promotion.terms}
        </p>
      )}

      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 border border-crimson/50 bg-crimson/10 px-3 py-2 text-xs text-crimson-bright"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {confirming ? (
          <>
            {/* "Cancelar" queda donde estaba "Canjear": si el dedo sigue
                apoyado ahí, lo peor que puede pasar es cerrar el paso. */}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setConfirmingSince(null)}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="flex-1"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {pending ? "Registrando…" : "Confirmar canje"}
            </Button>
          </>
        ) : (
          // Doble toque a propósito: evita canjes accidentales en la barra.
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setConfirmingSince(Date.now())}
          >
            Canjear
          </Button>
        )}
      </div>
    </form>
  );
}
