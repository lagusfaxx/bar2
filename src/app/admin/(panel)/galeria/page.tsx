import { ArrowDown, ArrowUp, Eye, EyeOff, Star, StarOff, Trash2 } from "lucide-react";
import Image from "next/image";

import {
  deleteGalleryImage,
  moveGalleryImage,
  toggleGalleryImage,
} from "@/app/actions/admin/content";
import { ActionButton } from "@/components/admin/action-button";
import { GalleryUploader } from "@/components/admin/gallery-uploader";
import { AdminHeader, EmptyState, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/section";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Galería" };

export default async function AdminGaleriaPage() {
  const [images, events] = await Promise.all([
    prisma.galleryImage.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      include: { event: { select: { title: true } } },
    }),
    prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      take: 60,
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <AdminHeader
        title="Fotos del local"
        description="Las fotos que salen en la galería de la web. Se achican solas para que cargue rápido en los teléfonos."
      />

      <div className="mb-8">
        <GalleryUploader events={events} />
      </div>

      {images.length === 0 ? (
        <EmptyState
          title="Todavía no hay fotos"
          description="Sube las primeras imágenes para que la galería del sitio deje de estar vacía."
        />
      ) : (
        <Panel
          title={`${images.length} imágenes`}
          description="Las primeras del orden son las que se ven en la portada."
        >
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <li key={image.id} className="border border-line bg-ink">
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 45vw, 22vw"
                    className="object-cover"
                    unoptimized={image.url.startsWith("http")}
                  />

                  {!image.active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/75 text-xs tracking-[0.16em] text-muted uppercase">
                      Oculta
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 p-3">
                  <p className="line-clamp-2 text-xs text-bone-dim">{image.alt}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {image.featured && <Badge tone="gilt">Destacada</Badge>}
                    {image.tag && <Badge tone="muted">{image.tag}</Badge>}
                  </div>

                  {image.event && (
                    <p className="line-clamp-1 text-[0.65rem] text-crimson-bright">
                      {image.event.title}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <ActionButton
                      action={async () => {
                        "use server";
                        await moveGalleryImage(image.id, "up");
                      }}
                      title="Subir en el orden"
                      aria-label="Subir en el orden"
                      className={index === 0 ? "pointer-events-none opacity-30" : ""}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </ActionButton>

                    <ActionButton
                      action={async () => {
                        "use server";
                        await moveGalleryImage(image.id, "down");
                      }}
                      title="Bajar en el orden"
                      aria-label="Bajar en el orden"
                      className={
                        index === images.length - 1
                          ? "pointer-events-none opacity-30"
                          : ""
                      }
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </ActionButton>

                    <ActionButton
                      action={async () => {
                        "use server";
                        await toggleGalleryImage(image.id, "featured", !image.featured);
                      }}
                      title={image.featured ? "Quitar destacada" : "Destacar"}
                      aria-label={image.featured ? "Quitar destacada" : "Destacar"}
                    >
                      {image.featured ? (
                        <StarOff className="size-4" aria-hidden />
                      ) : (
                        <Star className="size-4" aria-hidden />
                      )}
                    </ActionButton>

                    <ActionButton
                      action={async () => {
                        "use server";
                        await toggleGalleryImage(image.id, "active", !image.active);
                      }}
                      title={image.active ? "Ocultar" : "Mostrar"}
                      aria-label={image.active ? "Ocultar" : "Mostrar"}
                    >
                      {image.active ? (
                        <EyeOff className="size-4" aria-hidden />
                      ) : (
                        <Eye className="size-4" aria-hidden />
                      )}
                    </ActionButton>

                    <ActionButton
                      variant="danger"
                      confirm="¿Eliminar esta imagen de la galería?"
                      action={async () => {
                        "use server";
                        await deleteGalleryImage(image.id);
                      }}
                      title="Eliminar"
                      aria-label="Eliminar imagen"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
