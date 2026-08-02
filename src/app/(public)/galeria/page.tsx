import type { Metadata } from "next";

import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getGallery, getSettings } from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description = `Fotos de shows, tributos, público y ambiente en ${settings.barName}.`;

  return {
    title: "Galería",
    description,
    alternates: { canonical: absoluteUrl("/galeria") },
    openGraph: {
      title: `Galería · ${settings.barName}`,
      description,
      url: absoluteUrl("/galeria"),
    },
  };
}

export default async function GaleriaPage() {
  const [images, settings] = await Promise.all([getGallery(80), getSettings()]);

  return (
    <>
      <PageHeader
        eyebrow="Galería"
        title="Noches que quedan"
        lead={`Shows, tributos, barra y público. Un recorrido por lo que se vive cada semana en ${settings.barName}.`}
        image={images[0]?.url ?? "/demo/gallery-1.jpg"}
      />

      <Section className="container-bz">
        {images.length > 0 ? (
          <GalleryGrid
            images={images.map((image) => ({
              id: image.id,
              url: image.url,
              alt: image.alt,
              caption: image.caption,
              tag: image.tag,
              event: image.event,
            }))}
          />
        ) : (
          <p className="card-bz p-12 text-center text-muted">
            Todavía no cargamos fotos. Volvé pronto.
          </p>
        )}
      </Section>
    </>
  );
}

/** Regeneracion periodica; el CMS ademas invalida al guardar. */
export const revalidate = 300;
