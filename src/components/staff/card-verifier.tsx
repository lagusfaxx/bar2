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
 * Tres formas de identificar la tarjeta, en orden de comodidad:
 *  1. La cámara del propio teléfono, si el navegador expone BarcodeDetector.
 *  2. La cámara nativa del sistema: el QR contiene la URL /staff/verificar/…
 *     y abre esta misma pantalla ya resuelta.
 *  3. Los 16 dígitos escritos a mano, con verificación de dígito de control.
 *
 * La decisión de si una promoción se puede canjear la toma siempre el servidor.
 */
export function CardVerifier({ initial }: { initial?: CardLookup }) {
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

    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!Detector) {
      setScanError(
        "Este navegador no puede escanear desde la app. Usa la cámara del teléfono sobre el QR, o carga los 16 dígitos.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // La cámara trasera es la que apunta a la tarjeta del cliente.
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue;

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
    } catch {
      setScanError(
        "No pudimos acceder a la cámara. Revisa los permisos del navegador o carga los dígitos a mano.",
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
          Número de tarjeta o QR
        </label>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="5210 •••• •••• ••••"
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
        <h2 className="mb-3 text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase">
          Disponibles ({eligible.length})
        </h2>

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
