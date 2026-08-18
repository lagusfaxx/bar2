import "server-only";

import { withinBirthdayWindow } from "@/lib/barzucard";
import { getSettings } from "@/lib/content";
import { sendEmail } from "@/lib/email";
import { birthdayEmail } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

/**
 * El saludo de cumpleanos.
 *
 * Corre una vez al dia y saluda a quien cumple hoy. Lo llama la ruta
 * `/api/cron/cumpleanos`, que dispara un temporizador externo.
 *
 * El correo se manda el dia exacto y no en toda la ventana: la ventana es
 * cuanto tiempo el beneficio sigue siendo canjeable, no cuantas veces se le
 * escribe al socio. Un local que saluda siete dias seguidos deja de ser un
 * local que se acuerda y pasa a ser uno que molesta.
 */
export type ResumenCumpleanos = {
  saludados: number;
  fallidos: number;
  /** Socios que cumplen hoy pero ya habian sido saludados este ano. */
  omitidos: number;
  promocion: string | null;
};

export async function sendBirthdayGreetings(
  now = new Date(),
): Promise<ResumenCumpleanos> {
  const ano = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/Santiago",
      year: "numeric",
    }).format(now),
  );

  /*
   * Los candidatos.
   *
   * Se filtra en memoria y no en SQL porque la condicion es "mismo dia y mes,
   * cualquier ano", que en Postgres obliga a funciones sobre la columna y a un
   * indice aparte. Con la cantidad de socios de un bar —miles, no millones— una
   * pasada diaria por la lista es mas barata que mantener ese indice, y deja la
   * regla escrita una sola vez, en `withinBirthdayWindow`, compartida con lo
   * que decide si el beneficio se puede canjear.
   */
  const candidatos = await prisma.member.findMany({
    where: {
      birthDate: { not: null },
      // Quien pidio no recibir novedades tampoco recibe esto. Es un correo
      // comercial aunque venga envuelto en un saludo.
      acceptsNews: true,
      card: { status: "ACTIVE" },
      // Ya saludado este ano: no vuelve a entrar.
      OR: [{ birthdayGreetedYear: null }, { birthdayGreetedYear: { not: ano } }],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      birthDate: true,
      birthdayGreetedYear: true,
    },
  });

  const deHoy = candidatos.filter(
    (member) => member.birthDate && withinBirthdayWindow(member.birthDate, now, 0),
  );

  if (deHoy.length === 0) {
    return { saludados: 0, fallidos: 0, omitidos: 0, promocion: null };
  }

  /*
   * El beneficio que se les nombra.
   *
   * Se toma la promocion de cumpleanos activa de mayor prioridad. Si no hay
   * ninguna, el saludo sale igual: un local que se acuerda del cumpleanos de un
   * cliente ya gano algo, y mandar nada es peor que mandar solo el saludo.
   */
  const promocion = await prisma.promotion.findFirst({
    where: {
      birthdayOnly: true,
      active: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { position: "asc" },
    select: { title: true, description: true, terms: true },
  });

  const settings = await getSettings();

  let saludados = 0;
  let fallidos = 0;

  for (const member of deHoy) {
    const { subject, html } = birthdayEmail({
      barName: settings.barName,
      logoUrl: settings.logoUrl,
      fullName: member.fullName,
      promocion,
    });

    const resultado = await sendEmail({
      to: member.email,
      subject,
      html,
      kind: "CUMPLEANOS",
      memberId: member.id,
    });

    if (resultado.ok) {
      saludados += 1;

      /*
       * La marca se pone solo si el correo salio.
       *
       * Marcarlo antes seria mas simple y dejaria al socio sin saludo cuando el
       * proveedor falla: la corrida del dia siguiente lo daria por hecho y ese
       * cumpleanos se perderia para siempre. Asi, un fallo se reintenta manana
       * —tarde, pero se manda—.
       */
      await prisma.member.update({
        where: { id: member.id },
        data: { birthdayGreetedYear: ano },
      });
    } else {
      fallidos += 1;
    }
  }

  return {
    saludados,
    fallidos,
    omitidos: candidatos.length - deHoy.length,
    promocion: promocion?.title ?? null,
  };
}
