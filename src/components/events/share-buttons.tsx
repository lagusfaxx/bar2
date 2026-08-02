"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { SocialIcon } from "@/components/site/social-icon";

type ShareButtonsProps = {
  url: string;
  title: string;
  text?: string;
};

/**
 * Compartir evento. Si el navegador soporta la Web Share API (el caso habitual
 * en móviles) se ofrece el diálogo nativo; si no, quedan los enlaces directos a
 * WhatsApp, Facebook y X más el botón de copiar.
 */
export function ShareButtons({ url, title, text }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canShareNatively, setCanShareNatively] = useState(false);

  // navigator.share solo existe en el cliente: se comprueba tras montar para no
  // romper la hidratación.
  useEffect(() => {
    setCanShareNatively(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const shareText = text ?? title;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro) mostramos el enlace
      // para que la persona pueda copiarlo a mano.
      window.prompt("Copiá el enlace del evento:", url);
    }
  };

  const shareNatively = async () => {
    try {
      await navigator.share({ title, text: shareText, url });
    } catch {
      // El usuario canceló el diálogo: no hay nada que informar.
    }
  };

  const networks = [
    {
      platform: "whatsapp",
      label: "Compartir por WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
    {
      platform: "facebook",
      label: "Compartir en Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      platform: "x",
      label: "Compartir en X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow mr-1 text-muted">Compartir</span>

      {canShareNatively && (
        <button
          type="button"
          onClick={shareNatively}
          aria-label="Compartir este evento"
          className="flex size-10 items-center justify-center border border-line text-bone-dim transition-all duration-500 hover:border-crimson hover:text-crimson-bright"
        >
          <Share2 className="size-4" aria-hidden />
        </button>
      )}

      {networks.map((network) => (
        <a
          key={network.platform}
          href={network.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={network.label}
          title={network.label}
          className="flex size-10 items-center justify-center border border-line text-bone-dim transition-all duration-500 hover:border-crimson hover:text-crimson-bright"
        >
          <SocialIcon platform={network.platform} className="size-4" />
        </a>
      ))}

      <button
        type="button"
        onClick={copy}
        aria-label="Copiar enlace del evento"
        className="flex h-10 items-center gap-2 border border-line px-3 text-[0.65rem] tracking-[0.15em] text-bone-dim uppercase transition-all duration-500 hover:border-crimson hover:text-crimson-bright"
      >
        {copied ? (
          <>
            <Check className="size-4 text-emerald-400" aria-hidden />
            Copiado
          </>
        ) : (
          <>
            <Copy className="size-4" aria-hidden />
            Copiar
          </>
        )}
      </button>
    </div>
  );
}
