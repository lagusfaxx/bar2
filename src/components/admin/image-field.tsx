"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

import { uploadImage } from "@/app/actions/admin/content";
import { cn } from "@/lib/utils";

type ImageFieldProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  preset?: "poster" | "cover" | "gallery" | "product" | "logo";
  hint?: string;
  error?: string;
  aspect?: string;
  required?: boolean;
};

/**
 * Campo de imagen del panel: sube el archivo, muestra la vista previa y deja
 * la URL final en un input oculto para que la envíe el formulario que lo
 * contiene. También acepta pegar una URL externa a mano.
 */
export function ImageField({
  label,
  name,
  defaultValue,
  preset = "gallery",
  hint,
  error,
  aspect = "aspect-4/3",
  required,
}: ImageFieldProps) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Cuando el formulario que contiene este campo se reinicia, la vista previa
  // debe volver a su valor inicial.
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
    data.set("preset", preset);

    startTransition(async () => {
      const result = await uploadImage({ status: "idle" }, data);

      if (result.status === "success" && typeof result.data?.url === "string") {
        setUrl(result.data.url);
      } else {
        setMessage(result.message ?? "No pudimos subir la imagen.");
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
        {required && <span className="ml-1 text-crimson">*</span>}
      </label>

      {/* La URL es lo que realmente viaja en el formulario. */}
      <input ref={hiddenRef} type="hidden" name={name} value={url} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden border border-line bg-ink sm:w-48",
            aspect,
          )}
        >
          {url ? (
            <>
              <Image
                src={url}
                alt=""
                fill
                sizes="192px"
                className="object-cover"
                unoptimized={url.startsWith("http")}
              />
              <button
                type="button"
                onClick={() => setUrl("")}
                aria-label="Quitar imagen"
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
                <ImagePlus className="size-6" aria-hidden />
              )}
              <span className="text-xs">
                {pending ? "Subiendo…" : "Sin imagen"}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              // Permite volver a elegir el mismo archivo tras un error.
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
              <ImagePlus className="size-4" aria-hidden />
            )}
            {url ? "Reemplazar imagen" : "Subir imagen"}
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
