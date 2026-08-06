"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lectura de un QR con la camara del telefono.
 *
 * Vivia dentro de la pantalla de verificacion de tarjetas. Ahora el POS
 * tambien escanea —la garzona presenta la BarzuCard desde la mesa— y copiar
 * ciento veinte lineas de camara, lienzo y ciclo de fotogramas en un segundo
 * archivo era garantizar que uno de los dos se quedara atras.
 *
 * Se prefiere `BarcodeDetector`, que resuelve el sistema operativo; cuando no
 * existe —Safari, Firefox— se carga jsQR bajo demanda, para no sumarle peso a
 * quien no lo necesita.
 */
export function useQrScanner(onResult: (value: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // El ciclo de fotogramas se arma una sola vez; sin esta referencia leeria
  // siempre el primer callback que recibio. Se actualiza en un efecto y no
  // durante el render, que es donde una referencia todavia no es estable.
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // La camara no puede quedar encendida cuando la pantalla se desmonta.
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setError(null);

    // Los navegadores solo entregan la camara en sitios seguros. Si el local
    // todavia entra por http://, conviene decirlo con todas las letras: es la
    // causa mas habitual de que el boton "no haga nada".
    if (!window.isSecureContext) {
      setError(
        "La cámara solo funciona con https://. Mientras el sitio esté en http, abre la cámara del teléfono y apunta al QR: se abre la pantalla del socio.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Este navegador no da acceso a la cámara. Abre la cámara del teléfono y apunta al QR de la tarjeta.",
      );
      return;
    }

    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (
            source: CanvasImageSource,
          ) => Promise<Array<{ rawValue: string }>>;
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
      return (
        jsQR(image.data, side, side, { inversionAttempts: "dontInvert" })?.data ??
        null
      );
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // La camara trasera es la que apunta a la tarjeta del cliente.
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
            stop();
            onResultRef.current(value);
            return;
          }
        } catch {
          // Un fotograma ilegible no es un error: seguimos con el siguiente.
        }

        requestAnimationFrame(() => void tick());
      };

      requestAnimationFrame(() => void tick());
    } catch (cause) {
      const denied =
        cause instanceof DOMException &&
        (cause.name === "NotAllowedError" || cause.name === "SecurityError");

      setError(
        denied
          ? "El navegador bloqueó la cámara. Permítela para este sitio en los ajustes del teléfono. Mientras tanto puedes escribir los 16 dígitos."
          : "No pudimos abrir la cámara. Revisa que ninguna otra aplicación la esté usando, o escribe los 16 dígitos.",
      );
      stop();
    }
  }, [stop]);

  return { videoRef, scanning, error, start, stop, setError };
}
