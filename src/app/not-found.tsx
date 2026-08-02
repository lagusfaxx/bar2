import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 -z-10 size-[30rem] -translate-x-1/2 rounded-full bg-crimson/12 blur-[130px]"
      />

      <p className="font-western text-[0.7rem] tracking-[0.35em] text-crimson-bright">
        Error 404
      </p>

      <h1 className="mt-6 font-western text-[clamp(3rem,14vw,7rem)] leading-none text-crimson">
        BAR<span className="text-bone">Z</span>UO
      </h1>

      <p className="mt-8 max-w-md text-base text-muted">
        Esta página no existe o se mudó de lugar. Pero la noche sigue: mirá qué
        se viene en la cartelera.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <ButtonLink href="/eventos" size="lg">
          Ver la cartelera
        </ButtonLink>
        <ButtonLink href="/" variant="outline" size="lg">
          Volver al inicio
        </ButtonLink>
      </div>

      <Link
        href="/contacto"
        className="mt-10 text-sm text-muted-dark underline-offset-4 transition-colors hover:text-bone-dim hover:underline"
      >
        ¿Buscabas algo puntual? Escribinos
      </Link>
    </main>
  );
}
