"use server";

import { requireCmsUser } from "@/lib/auth";
import { revalidateContent } from "@/lib/cache";
import { formError, formSuccess, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/utils";
import {
  fieldErrors,
  menuCategorySchema,
  menuProductSchema,
  parsePriceToCents,
} from "@/lib/validation";

import { recordAudit } from "./audit";

// --- Categorías --------------------------------------------------------------

export async function saveMenuCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const rawId = formData.get("id");
  const categoryId = typeof rawId === "string" && rawId ? rawId : null;

  const parsed = menuCategorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos de la categoría.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  const slug = await uniqueSlug(input.slug || input.name, async (candidate) => {
    const found = await prisma.menuCategory.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return !!found && found.id !== categoryId;
  });

  const data = {
    slug,
    name: input.name,
    description: input.description || null,
    imageUrl: input.imageUrl || null,
    icon: input.icon || null,
    active: input.active,
    publicMenu: input.publicMenu,
    station: input.station,
  };

  if (categoryId) {
    await prisma.menuCategory.update({ where: { id: categoryId }, data });
  } else {
    // Nueva categoría: va al final del orden actual.
    const last = await prisma.menuCategory.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.menuCategory.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
    });
  }

  await recordAudit(
    session.userId,
    categoryId ? "update" : "create",
    "MenuCategory",
    categoryId ?? undefined,
    input.name,
  );

  revalidateContent("menu");
  return formSuccess("Categoría guardada.");
}

export async function deleteMenuCategory(id: string) {
  const session = await requireCmsUser();

  const category = await prisma.menuCategory.delete({
    where: { id },
    select: { name: true },
  });

  await recordAudit(session.userId, "delete", "MenuCategory", id, category.name);
  revalidateContent("menu");
}

/**
 * Enciende o apaga una categoria desde la lista de la carta.
 *
 * `active` la saca de todas partes —web, carta de la mesa y POS—; `publicMenu`
 * solo de la vitrina de la web.
 */
export async function toggleMenuCategory(
  id: string,
  field: "active" | "publicMenu",
  value: boolean,
) {
  await requireCmsUser();
  await prisma.menuCategory.update({ where: { id }, data: { [field]: value } });
  revalidateContent("menu");
}

/**
 * Mueve una categoría una posición arriba o abajo intercambiándola con su
 * vecina. Se resuelve en una transacción para que el orden nunca quede
 * duplicado si dos personas reordenan a la vez.
 */
export async function moveMenuCategory(id: string, direction: "up" | "down") {
  await requireCmsUser();

  const current = await prisma.menuCategory.findUnique({
    where: { id },
    select: { id: true, position: true },
  });

  if (!current) return;

  const neighbour = await prisma.menuCategory.findFirst({
    where:
      direction === "up"
        ? { position: { lt: current.position } }
        : { position: { gt: current.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });

  if (!neighbour) return;

  await prisma.$transaction([
    prisma.menuCategory.update({
      where: { id: current.id },
      data: { position: neighbour.position },
    }),
    prisma.menuCategory.update({
      where: { id: neighbour.id },
      data: { position: current.position },
    }),
  ]);

  revalidateContent("menu");
}

// --- Productos ---------------------------------------------------------------

export async function saveMenuProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireCmsUser();

  const rawId = formData.get("id");
  const productId = typeof rawId === "string" && rawId ? rawId : null;

  const parsed = menuProductSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError("Revisa los datos del producto.", fieldErrors(parsed.error));
  }

  const input = parsed.data;

  let priceCents: number;
  try {
    priceCents = parsePriceToCents(input.price);
  } catch {
    return formError("El precio no es válido.", { price: "Precio inválido" });
  }

  const category = await prisma.menuCategory.findUnique({
    where: { id: input.categoryId },
    select: { slug: true },
  });

  if (!category) {
    return formError("La categoría seleccionada ya no existe.", {
      categoryId: "Elige una categoría válida",
    });
  }

  const slug = await uniqueSlug(
    input.slug || `${category.slug}-${input.name}`,
    async (candidate) => {
      const found = await prisma.menuProduct.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return !!found && found.id !== productId;
    },
  );

  // El precio promocional es opcional, pero si esta debe ser una rebaja real:
  // uno mayor al de lista seria un aumento disfrazado de promocion.
  let promoPriceCents: number | null = null;

  if (input.promoPrice) {
    try {
      promoPriceCents = parsePriceToCents(input.promoPrice);
    } catch {
      return formError("El precio promocional no es válido.", {
        promoPrice: "Precio inválido",
      });
    }

    if (promoPriceCents >= priceCents) {
      return formError("La promoción no rebaja el precio.", {
        promoPrice: "Debe ser menor que el precio normal",
      });
    }
  }

  const promoStartsAt = input.promoStartsAt ? new Date(input.promoStartsAt) : null;
  const promoEndsAt = input.promoEndsAt ? new Date(input.promoEndsAt) : null;

  if (promoStartsAt && promoEndsAt && promoEndsAt <= promoStartsAt) {
    return formError("La promoción termina antes de empezar.", {
      promoEndsAt: "Debe ser posterior al inicio",
    });
  }

  const data = {
    categoryId: input.categoryId,
    slug,
    name: input.name,
    description: input.description || null,
    priceCents,
    imageUrl: input.imageUrl || null,
    available: input.available,
    featured: input.featured,
    publicMenu: input.publicMenu,
    station: input.station || null,
    promoPriceCents,
    promoLabel: promoPriceCents !== null ? input.promoLabel || null : null,
    promoStartsAt: promoPriceCents !== null ? promoStartsAt : null,
    promoEndsAt: promoPriceCents !== null ? promoEndsAt : null,
    tags: input.tags
      ? input.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
  };

  if (productId) {
    await prisma.menuProduct.update({ where: { id: productId }, data });
  } else {
    const last = await prisma.menuProduct.findFirst({
      where: { categoryId: input.categoryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.menuProduct.create({
      data: { ...data, position: (last?.position ?? -1) + 1 },
    });
  }

  await recordAudit(
    session.userId,
    productId ? "update" : "create",
    "MenuProduct",
    productId ?? undefined,
    input.name,
  );

  revalidateContent("menu");
  return formSuccess("Producto guardado.");
}

export async function deleteMenuProduct(id: string) {
  const session = await requireCmsUser();

  const product = await prisma.menuProduct.delete({
    where: { id },
    select: { name: true },
  });

  await recordAudit(session.userId, "delete", "MenuProduct", id, product.name);
  revalidateContent("menu");
}

export async function toggleMenuProduct(
  id: string,
  field: "available" | "featured" | "publicMenu",
  value: boolean,
) {
  await requireCmsUser();
  await prisma.menuProduct.update({ where: { id }, data: { [field]: value } });
  revalidateContent("menu");
}

export async function moveMenuProduct(id: string, direction: "up" | "down") {
  await requireCmsUser();

  const current = await prisma.menuProduct.findUnique({
    where: { id },
    select: { id: true, position: true, categoryId: true },
  });

  if (!current) return;

  const neighbour = await prisma.menuProduct.findFirst({
    where: {
      categoryId: current.categoryId,
      position:
        direction === "up" ? { lt: current.position } : { gt: current.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });

  if (!neighbour) return;

  await prisma.$transaction([
    prisma.menuProduct.update({
      where: { id: current.id },
      data: { position: neighbour.position },
    }),
    prisma.menuProduct.update({
      where: { id: neighbour.id },
      data: { position: current.position },
    }),
  ]);

  revalidateContent("menu");
}
