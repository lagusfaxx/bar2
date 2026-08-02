"use client";

import { Film, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { uploadVideo } from "@/app/actions/admin/content";

type VideoFieldProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: string;
  error?: string;
};

/**
 * Campo de video del panel, gemelo de ImageField: sube el archivo, muestra una
 * vista previa reproducible y deja la URL en un input oculto que viaja con el
 * formulario. Tambien acepta pegar la URL de un video alojado en otro sitio.
 */
export function VideoField({
  label,
  name,
  defaultValue,
  hint,
  error,
}: VideoFieldProps) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;

    const onReset = () => setUrl(defaultValue ?? "");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  const upload = (file: File) => {
    setMessage(null);

    const data = new FormData();
    data.set("file", file);

    startTransition(async () => {
      const result = await uploadVideo({ status: "idle" }, data);

      if (result.status === "success" && typeof result.data?.url === "string") {
        setUrl(result.data.url);
      } else {
        setMessage(result.message ?? "No pudimos subir el video.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={`${name}-url`}
        className="text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase"
      >
        {label}
      </label>

      <input ref={hiddenRef} type="hidden" name={name} value={url} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative aspect-16/9 w-full shrink-0 overflow-hidden border border-line bg-ink sm:w-48">
          {url ? (
            <>
              {/* Silenciado y en bucle, igual que en la portada. */}
              <video
                src={url}
                className="size-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
              <button
                type="button"
                onClick={() => setUrl("")}
                aria-label="Quitar video"
                className="absolute top-2 right-2 flex size-8 items-center justify-center border border-line bg-ink/85 text-bone-dim transition-colors hover:border-crimson hover:text-crimson-bright"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-dark">
              {pending ? (
                <Loader2 className="size-6 animate-spin" aria-hidden />
              ) : (
                <Film className="size-6" aria-hidden />
              )}
              <span className="text-xs">{pending ? "Subiendo…" : "Sin video"}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="flex items-center justify-center gap-2 border border-line px-4 py-3 text-[0.68rem] font-medium tracking-[0.16em] text-bone-dim uppercase transition-colors hover:border-crimson hover:text-bone disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Film className="size-4" aria-hidden />
            )}
            {url ? "Reemplazar video" : "Subir video"}
          </button>

          <input
            id={`${name}-url`}
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="…o pega una URL"
            className="w-full border border-line bg-ink px-3 py-2.5 text-xs text-bone placeholder:text-muted-dark focus:border-crimson focus:outline-none"
          />

          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="flex items-center gap-2 self-start px-1 py-1 text-xs text-muted transition-colors hover:text-crimson-bright"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Quitar
            </button>
          )}

          {hint && <p className="text-xs text-muted-dark">{hint}</p>}
          {(message || error) && (
            <p role="alert" className="text-xs text-crimson-bright">
              {message ?? error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
