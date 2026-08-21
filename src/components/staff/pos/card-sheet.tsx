"use client";

import { Camera, CameraOff, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { attachCard } from "@/app/actions/pos";
import { Keyboard } from "@/components/staff/pos/keyboard";
import { useTecladoPropio } from "@/components/staff/use-pointer";
import { useQrScanner } from "@/components/staff/use-qr-scanner";
import { IDLE, type FormState } from "@/lib/form-state";

/**
 * Presentar la BarzuCard en la mesa.
 *
 * Un solo paso y tres formas de darlo, que son las tres que ocurren en sala:
 * apuntar la camara al QR del telefono del cliente, escribir los 16 digitos de
 * la tarjeta de plastico, o pegar el codigo del cupon que el socio ya emitio.
 * Las tres entran por el mismo campo y el servidor decide cual es.
 */
export function CardSheet({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<FormState>(IDLE);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  /**
   * Que teclado se muestra.
   *
   * Son dos cosas distintas las que se escriben aca. Los 16 digitos de la
   * tarjeta de plastico piden un pad de calculadora —teclas enormes, tres por
   * fila— porque son dieciseis toques seguidos y un error obliga a empezar de
   * nuevo. El codigo del cupon (BZD-••••••) lleva letras y pide el completo.
   * Arranca en numeros, que es el caso de todas las noches.
   */
  const [teclado, setTeclado] = useState<"numeros" | "texto">("numeros");

  /* En el telefono el numero se escribe con el teclado del sistema, que ya
     ofrece el pad numerico con `inputMode`. El nuestro es para el mostrador,
     donde no sube ninguno (ver `use-pointer`). */
  const tecladoPropio = useTecladoPropio();

  const submit = (input: string) => {
    if (!input.trim()) return;

    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("input", input.trim());

    startTransition(async () => {
      const result = await attachCard(IDLE, formData);
      setState(result);

      // Con la tarjeta ya en la mesa no queda nada por hacer aca: se vuelve a
      // la cuenta, que es donde estan los beneficios.
      if (result.status === "success") onClose();
    });
  };

  const {
    videoRef,
    scanning,
    error: scanError,
    start: startCamera,
    stop: stopCamera,
  } = useQrScanner((scanned) => {
    setValue(scanned);
    submit(scanned);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Presentar BarzuCard"
      className="fixed inset-0 z-50 flex h-[100dvh] items-end bg-ink/80 backdrop-blur-sm"
    >
      <div className="max-h-full w-full overflow-y-auto overscroll-contain border-t border-line bg-ink-soft p-5 pb-safe">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Beneficios de la mesa</p>
            <h2 className="font-display text-xl text-bone">
              Presentar BarzuCard
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="flex size-11 items-center justify-center border border-line text-bone"
            aria-label="Cancelar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* Camara: el camino rapido. El QR vive en el telefono del socio. */}
        {scanning ? (
          <div className="mt-5">
            <div className="relative aspect-square w-full overflow-hidden border border-crimson bg-ink">
              <video
                ref={videoRef}
                className="size-full object-cover"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-8 border-2 border-bone/70" />
            </div>

            <button
              type="button"
              onClick={stopCamera}
              className="mt-3 flex h-14 w-full items-center justify-center gap-2 border border-line text-base text-bone-dim"
            >
              <CameraOff className="size-5" aria-hidden />
              Apagar la cámara
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="mt-5 flex h-16 w-full items-center justify-center gap-2 bg-crimson text-lg font-medium text-bone"
          >
            <Camera className="size-5" aria-hidden />
            Escanear el QR
          </button>
        )}

        {/*
          El numero, con el teclado que pone la app.

          La pantalla del mostrador no levanta el del sistema al enfocar un
          campo, asi que antes esto se podia tocar y no pasaba nada: quedaba
          solo la camara, y la tarjeta de plastico no tiene QR. El campo es de
          solo lectura y todo entra por las teclas de abajo.
        */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-bone">O escribe el número</span>

            <button
              type="button"
              onClick={() =>
                setTeclado((actual) => (actual === "numeros" ? "texto" : "numeros"))
              }
              className="text-xs uppercase tracking-[0.14em] text-muted underline underline-offset-4"
            >
              {teclado === "numeros" ? "Código BZD" : "Números"}
            </button>
          </div>

          {tecladoPropio ? (
            <p
              aria-live="polite"
              className="mt-2 flex h-14 w-full items-center border border-line bg-ink px-3 font-mono text-lg tracking-[0.12em] text-bone"
            >
              {value || (
                <span className="text-muted-dark">5210 •••• •••• ••••</span>
              )}
            </p>
          ) : (
            <input
              type="text"
              inputMode={teclado === "numeros" ? "numeric" : "text"}
              autoComplete="off"
              enterKeyHint="done"
              aria-label="Número de la tarjeta o código del cupón"
              value={value}
              onChange={(event) => setValue(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit(value);
              }}
              placeholder="5210 •••• •••• ••••"
              className="mt-2 h-14 w-full border border-line bg-ink px-3 font-mono text-lg tracking-[0.12em] text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
            />
          )}

          <span className="mt-1 block text-xs text-muted">
            Sirven los 16 dígitos de la tarjeta física o el código del cupón
            (BZD-••••••).
          </span>
        </div>

        {(state.status === "error" || scanError) && (
          <p role="alert" className="mt-4 text-sm text-crimson-bright">
            {scanError ?? state.message}
          </p>
        )}

        <button
          type="button"
          onClick={() => submit(value)}
          disabled={pending || !value.trim()}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 border border-line text-base text-bone disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            "Buscar tarjeta"
          )}
        </button>

        {/* Al pie y a lo ancho, como cualquier teclado: asi el boton de buscar
            queda arriba y a la vista en vez de esconderse debajo de las teclas.
            En un telefono no va: ahi el teclado lo pone el sistema. */}
        {tecladoPropio && (
          <div className="-mx-5 mt-4">
            <Keyboard
              variant={teclado}
              onKey={(char) =>
                setValue((actual) => (actual + char).toUpperCase().slice(0, 24))
              }
              onBackspace={() => setValue((actual) => actual.slice(0, -1))}
              onClear={() => setValue("")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
