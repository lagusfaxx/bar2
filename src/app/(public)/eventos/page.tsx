import type { Metadata } from "next";

import { EventCalendar, type CalendarEvent } from "@/components/events/event-calendar";
import { EventCard } from "@/components/events/event-card";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/section";
import {
  getEventsInRange,
  getFeaturedEvents,
  getPastEvents,
  getSettings,
  getUpcomingEvents,
} from "@/lib/content";
import { absoluteUrl } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = "Cartelera";
  const description = `Todos los shows en vivo, tributos, DJ sets y fiestas de ${settings.barName}. Consultá el calendario y reservá tu lugar.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl("/eventos") },
    openGraph: {
      title: `${title} · ${settings.barName}`,
      description,
      url: absoluteUrl("/eventos"),
    },
  };
}

/** Ventana del calendario: dos meses hacia atrás y un año hacia adelante. */
function calendarRange() {
  const from = new Date();
  from.setMonth(from.getMonth() - 2, 1);
  from.setHours(0, 0, 0, 0);

  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);

  return { from: from.toISOString(), to: to.toISOString() };
}

export default async function EventosPage() {
  const { from, to } = calendarRange();

  const [settings, upcoming, featured, past, rangeEvents] = await Promise.all([
    getSettings(),
    getUpcomingEvents(30),
    getFeaturedEvents(3),
    getPastEvents(6),
    getEventsInRange(from, to),
  ]);

  // El calendario corre en el cliente: las fechas viajan serializadas.
  const calendarEvents: CalendarEvent[] = rangeEvents.map((event) => ({
    ...event,
    startsAt: event.startsAt.toISOString(),
    doorsAt: event.doorsAt?.toISOString() ?? null,
  }));

  const featuredIds = new Set(featured.map((event) => event.id));
  const rest = upcoming.filter((event) => !featuredIds.has(event.id));

  return (
    <>
      <PageHeader
        eyebrow="Cartelera"
        title={
          <>
            Todo lo que suena en{" "}
            <span className="font-western text-crimson">BARZUO</span>
          </>
        }
        lead={`Tributos, bandas en vivo, DJ sets y fiestas. Elegí la noche que más te guste y reservá tu mesa en ${settings.barName}.`}
        image={settings.heroImageUrl ?? "/demo/hero.jpg"}
      />

      {featured.length > 0 && (
        <Section className="container-bz">
          <SectionHeading
            eyebrow="Destacados"
            title="No te los pierdas"
            lead="Las noches que más se piden y que suelen agotar entradas."
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((event, index) => (
              <Reveal key={event.id} delay={index * 80}>
                <EventCard event={event} priority={index === 0} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      <Section id="calendario" className="container-bz border-t border-line">
        <SectionHeading
          eyebrow="Calendario"
          title="Elegí tu noche"
          lead="Los días marcados tienen función. Tocá uno para ver el detalle, o cambiá a la vista de lista."
        />

        <div className="mt-12">
          <EventCalendar events={calendarEvents} />
        </div>
      </Section>

      {rest.length > 0 && (
        <Section className="container-bz border-t border-line">
          <SectionHeading
            eyebrow="Próximas fechas"
            title="Agenda completa"
            lead="Todo lo que viene, en orden cronológico."
          />

          <div className="mt-12 flex flex-col gap-4">
            {rest.map((event, index) => (
              <Reveal key={event.id} delay={Math.min(index, 6) * 60}>
                <EventCard event={event} layout="wide" />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {past.length > 0 && (
        <Section className="border-t border-line bg-ink-soft">
          <div className="container-bz">
            <SectionHeading
              eyebrow="Ya pasaron"
              title="Noches que quedaron"
              lead="Un repaso por los últimos shows. Si estuviste, podés dejar tu calificación."
            />

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((event, index) => (
                <Reveal key={event.id} delay={index * 70}>
                  <EventCard event={event} className="opacity-80 hover:opacity-100" />
                </Reveal>
              ))}
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
