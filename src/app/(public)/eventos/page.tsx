import { ChevronDown } from "lucide-react";
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
  const description = `Todos los shows en vivo, tributos, DJ sets y fiestas de ${settings.barName}. Consulta el calendario y reserva tu lugar.`;

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

/** Fechas visibles antes de plegar el resto de la agenda. */
const VISIBLE_UPCOMING = 5;

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
        lead={`Tributos, bandas en vivo, DJ sets y fiestas. Elige la noche que más te guste y reserva tu mesa en ${settings.barName}.`}
        image={settings.heroImageUrl ?? "/demo/hero.jpg"}
      />

      {featured.length > 0 && (
        <Section className="container-bz">
          <SectionHeading
            eyebrow="Destacados"
            title="No te los pierdas"
            lead="Las noches que más se piden y que suelen agotar entradas."
          />

          {/* En movil los afiches se deslizan en horizontal. */}
          <div className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {featured.map((event, index) => (
              <Reveal
                key={event.id}
                delay={index * 80}
                className="w-[70%] shrink-0 snap-start sm:w-auto"
              >
                <EventCard event={event} priority={index === 0} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      <Section id="calendario" className="container-bz border-t border-line">
        <SectionHeading
          eyebrow="Calendario"
          title="Elige tu noche"
          lead="Los días marcados tienen función. Toca uno para ver el detalle, o cambia a la vista de lista."
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
            {rest.slice(0, VISIBLE_UPCOMING).map((event, index) => (
              <Reveal key={event.id} delay={Math.min(index, 6) * 60}>
                <EventCard event={event} layout="wide" />
              </Reveal>
            ))}
          </div>

          {/* El resto de la agenda queda plegado: con la temporada cargada eran
              treinta fichas seguidas y la pagina no terminaba nunca. Se resuelve
              con <details> para que funcione aunque no cargue el JavaScript. */}
          {rest.length > VISIBLE_UPCOMING && (
            <details className="group mt-4">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-2 border border-line px-6 py-4 text-[0.68rem] font-medium tracking-[0.18em] text-bone-dim uppercase transition-colors hover:border-crimson hover:text-bone">
                <span className="group-open:hidden">
                  Ver las {rest.length - VISIBLE_UPCOMING} fechas restantes
                </span>
                <span className="hidden group-open:inline">Ver menos</span>
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>

              <div className="mt-4 flex flex-col gap-4">
                {rest.slice(VISIBLE_UPCOMING).map((event) => (
                  <EventCard key={event.id} event={event} layout="wide" />
                ))}
              </div>
            </details>
          )}
        </Section>
      )}

      {past.length > 0 && (
        <Section className="border-t border-line bg-ink-soft">
          <div className="container-bz">
            <SectionHeading
              eyebrow="Ya pasaron"
              title="Noches que quedaron"
              lead="Un repaso por los últimos shows. Si estuviste, puedes dejar tu calificación."
            />

            <div className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
              {past.map((event, index) => (
                <Reveal
                  key={event.id}
                  delay={index * 70}
                  className="w-[70%] shrink-0 snap-start sm:w-auto"
                >
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
