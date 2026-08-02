import { EventForm } from "@/components/admin/event-form";
import { AdminHeader } from "@/components/admin/ui";
import { toDateTimeLocal } from "@/lib/format";

export const metadata = { title: "Nuevo evento" };

export default function NuevoEventoPage() {
  // Sugerencia por defecto: el próximo sábado a las 22:00.
  const suggested = new Date();
  suggested.setDate(suggested.getDate() + ((6 - suggested.getDay() + 7) % 7 || 7));
  suggested.setHours(22, 0, 0, 0);

  return (
    <>
      <AdminHeader
        title="Nuevo evento"
        description="Carga el show y publicalo cuando esté listo."
        back={{ href: "/admin/eventos", label: "Volver a la cartelera" }}
      />

      <EventForm
        event={{
          category: "EN_VIVO",
          isFree: true,
          published: false,
          startsAt: toDateTimeLocal(suggested),
        }}
      />
    </>
  );
}
