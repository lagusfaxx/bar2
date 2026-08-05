import { ClosuresManager } from "@/components/admin/closures-manager";
import { AdminHeader } from "@/components/admin/ui";
import { dateOnlyKey, dayKey } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Días cerrados" };

export default async function ClosuresPage() {
  // Solo de hoy en adelante: los cierres pasados ya no hay nada que hacerles y
  // llenarian la lista hasta esconder los que vienen.
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const days = await prisma.closedDay.findMany({
    where: { date: { gte: desde } },
    orderBy: { date: "asc" },
  });

  /*
   * Shows publicados que caen en un dia cerrado.
   *
   * Si el local se arrienda para un evento privado, la cartelera de ese dia
   * deja de mostrarse — pero el evento sigue publicado en el panel, y nadie se
   * entera. Se avisa aca para que se pueda cambiar de fecha o despublicar, en
   * vez de descubrirlo cuando llegue gente a la puerta.
   */
  const eventos = await prisma.event.findMany({
    where: {
      published: true,
      startsAt: { gte: desde },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });

  const cerrados = new Set(days.map((day) => dateOnlyKey(day.date)));
  const choques = eventos
    .filter((event) => cerrados.has(dayKey(event.startsAt)))
    .map((event) => ({
      id: event.id,
      title: event.title,
      day: dayKey(event.startsAt),
    }));

  return (
    <>
      <AdminHeader
        title="Días cerrados"
        description="Cuando arriendan el local para un evento privado, o cierran por vacaciones, márcalo aquí y la cartelera lo avisa sola."
      />

      <ClosuresManager
        days={days.map((day) => ({
          id: day.id,
          date: day.date.toISOString(),
          day: dateOnlyKey(day.date),
          reason: day.reason,
          note: day.note,
        }))}
        conflicts={choques}
      />
    </>
  );
}
