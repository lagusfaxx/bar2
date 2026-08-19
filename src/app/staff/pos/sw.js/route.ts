/**
 * Service worker de la app de sala.
 *
 * Existe por una sola razon y conviene tenerla presente antes de agregarle
 * nada: en un bar, el wifi se cae. El garzon camina hasta la terraza, pierde
 * señal y toca la pantalla. Sin service worker eso es el dinosaurio del
 * navegador dentro de una app instalada, que es peor que un navegador: no hay
 * barra de direcciones para volver.
 *
 * Lo que hace, entonces, es lo minimo:
 *
 *   - Guarda lo que no cambia (el JavaScript y el CSS con hash en el nombre,
 *     los iconos) para que la app abra rapido y sin red.
 *   - Ante una navegacion sin red, muestra una pantalla propia que dice que
 *     no hay conexion y ofrece reintentar.
 *
 * Lo que NO hace, a proposito: guardar el HTML de la sala ni de las cuentas.
 * Esas pantallas son el estado del local en este momento —quien esta ocupado,
 * cuanto se debe, que falta enviar— y servir una copia vieja seria peor que no
 * mostrar nada: el garzon cobraria sobre datos de hace media hora. Tampoco
 * toca nada que no sea GET: los pedidos y los cobros viajan por POST y tienen
 * que llegar al servidor o fallar a la vista, nunca quedar en un limbo.
 *
 * Se sirve desde una ruta y no desde /public para poder mandar la cabecera
 * `Service-Worker-Allowed`, que es lo que permite que el alcance sea
 * /staff/pos —incluida esa direccion exacta, sin barra final— y no solo lo que
 * cuelga debajo.
 */

/** Se sube cuando cambia el contenido del worker: descarta lo guardado antes. */
const VERSION = "sala-v1";

const SOURCE = `
const CACHE = "${VERSION}";

/** Lo que se guarda: archivos con hash en el nombre, que nunca cambian. */
const ESTATICO = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/uploads/") ||
  url.pathname === "/staff/pos/icono.png";

const SIN_CONEXION = \`<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sin conexión</title>
<style>
  body {
    margin: 0; min-height: 100dvh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 1.25rem; padding: 2rem;
    background: #08070a; color: #f4efe7; text-align: center;
    font-family: system-ui, -apple-system, Segoe UI, sans-serif;
  }
  h1 { font-family: Georgia, serif; font-size: 1.5rem; margin: 0; }
  p { margin: 0; color: #9b958c; font-size: 0.95rem; max-width: 28rem; }
  button {
    min-height: 3.5rem; padding: 0 2rem; font-size: 1rem;
    color: #f4efe7; background: rgba(180,17,27,0.15);
    border: 1px solid #b4111b;
  }
</style>
</head>
<body>
  <h1>Sin conexión</h1>
  <p>La sala necesita internet para mostrar las mesas al día. Nada de lo que cargaste se perdió: vuelve a intentar cuando haya señal.</p>
  <button type="button" onclick="location.reload()">Reintentar</button>
</body>
</html>\`;

self.addEventListener("install", (event) => {
  // Entra en servicio apenas se instala: no tiene sentido esperar a que el
  // garzon cierre la app para estrenar una version arreglada.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((nombre) => nombre !== CACHE).map((nombre) => caches.delete(nombre)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Los pedidos y los cobros no pasan por aca. Ver el comentario del modulo.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (ESTATICO(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const guardado = await cache.match(request);
        if (guardado) return guardado;

        const respuesta = await fetch(request);
        if (respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return new Response(SIN_CONEXION, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
  }
});
`;

export function GET() {
  return new Response(SOURCE, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Permite que el alcance suba de /staff/pos/ a /staff/pos, que es la
      // direccion con la que se instala la app.
      "Service-Worker-Allowed": "/staff/pos",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
